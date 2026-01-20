import { useState, useCallback, useRef } from 'react';
import { createPlayers, getAlivePlayers, getAliveWerewolves, getAliveGoodPlayers, checkGameOver } from '../utils/roles';
import { generateAISpeech, generateAIVote, generateWerewolfKill, generateSeerCheck, generateWitchDecision, generateHunterShoot } from '../utils/ai';

// 游戏阶段枚举
export const GAME_PHASES = {
	SETUP: 'setup',           // 设置阶段（输入API Key）
	ROLE_REVEAL: 'reveal',    // 展示角色
	NIGHT: 'night',           // 夜晚
	NIGHT_RESULT: 'night_result', // 夜晚结果
	DAY_SPEECH: 'day_speech', // 白天发言
	DAY_VOTE: 'day_vote',     // 白天投票
	VOTE_RESULT: 'vote_result', // 投票结果
	GAME_OVER: 'game_over'    // 游戏结束
};

export function useGame() {
	const [players, setPlayers] = useState([]);
	const [phase, setPhase] = useState(GAME_PHASES.SETUP);
	const [day, setDay] = useState(1);
	const [logs, setLogs] = useState([]);
	const [speeches, setSpeeches] = useState([]);
	const [allSpeeches, setAllSpeeches] = useState([]); // 所有历史发言
	const [votes, setVotes] = useState({});
	const [currentSpeaker, setCurrentSpeaker] = useState(null);
	const [nightActions, setNightActions] = useState({});
	const [gameResult, setGameResult] = useState(null);
	const [isProcessing, setIsProcessing] = useState(false);
	const [humanAction, setHumanAction] = useState(null);

	const abortRef = useRef(false);

	// 添加日志
	const addLog = useCallback((message, type = 'info') => {
		setLogs(prev => [...prev, { message, type, time: new Date().toLocaleTimeString() }]);
	}, []);

	// 开始新游戏
	const startGame = useCallback((personalities = null, playerName = '玩家') => {
		abortRef.current = false;
		const newPlayers = createPlayers(0, personalities, playerName);
		setPlayers(newPlayers);
		setPhase(GAME_PHASES.ROLE_REVEAL);
		setDay(1);
		setLogs([]);
		setSpeeches([]);
		setAllSpeeches([]);
		setVotes({});
		setNightActions({});
		setGameResult(null);

		const humanPlayer = newPlayers.find(p => p.isHuman);
		addLog(`游戏开始！你的身份是: ${humanPlayer.role.emoji} ${humanPlayer.role.name}`, 'system');
		addLog(humanPlayer.role.description, 'info');

		// 如果是狼人，显示队友
		if (humanPlayer.role.id === 'werewolf') {
			const teammate = newPlayers.find(p => p.role.id === 'werewolf' && p.id !== humanPlayer.id);
			addLog(`你的狼人队友是: ${teammate.name}`, 'wolf');
		}
	}, [addLog]);

	// 进入夜晚
	const enterNight = useCallback(async () => {
		setPhase(GAME_PHASES.NIGHT);
		setNightActions({});
		addLog(`=== 第${day}天夜晚 ===`, 'phase');
		addLog('天黑请闭眼...', 'system');
	}, [day, addLog]);

	// 处理夜晚行动
	const processNightActions = useCallback(async () => {
		if (abortRef.current) return;
		setIsProcessing(true);

		const alivePlayers = getAlivePlayers(players);
		const aliveWolves = getAliveWerewolves(players);
		const humanPlayer = players.find(p => p.isHuman && p.isAlive);

		let killTarget = null;
		let seerResult = null;
		let witchActions = { healed: false, poisoned: null };

		const gameState = {
			day,
			phase: 'night',
			alivePlayers,
			todaySpeeches: speeches,
			allSpeeches,
			players
		};

		// 1. 狼人杀人
		addLog('狼人睁眼...', 'wolf');

		if (humanPlayer?.role.id === 'werewolf') {
			// 等待人类狼人选择
			setHumanAction({ type: 'werewolf_kill', targets: alivePlayers.filter(p => p.role.team === 'good') });
			return; // 等待人类操作
		} else {
			// AI狼人自动选择
			const targets = alivePlayers.filter(p => p.role.team === 'good');
			if (targets.length > 0 && aliveWolves.length > 0) {
				killTarget = await generateWerewolfKill(aliveWolves, targets, gameState);
			}
		}

		await continueNightAfterWerewolf(killTarget);
	}, [players, day, speeches, addLog]);

	// 狼人行动后继续夜晚流程
	const continueNightAfterWerewolf = useCallback(async (killTarget) => {
		if (abortRef.current) return;

		const alivePlayers = getAlivePlayers(players);
		const humanPlayer = players.find(p => p.isHuman && p.isAlive);

		const gameState = {
			day,
			phase: 'night',
			alivePlayers,
			todaySpeeches: speeches,
			allSpeeches,
			players
		};

		let seerResult = null;
		let witchActions = { healed: false, poisoned: null };

		// 2. 预言家查验
		const seer = alivePlayers.find(p => p.role.id === 'seer');
		const allSeer = players.find(p => p.role.id === 'seer');
		const isHumanSeer = humanPlayer?.role.id === 'seer';

		addLog('预言家睁眼...', 'seer');

		if (seer) {
			if (isHumanSeer) {
				setHumanAction({
					type: 'seer_check',
					targets: alivePlayers.filter(p => p.id !== humanPlayer.id),
					killTarget
				});
				return;
			} else {
				const targets = alivePlayers.filter(p => p.id !== seer.id);
				if (targets.length > 0) {
					const targetId = await generateSeerCheck(seer, targets, gameState);
					const target = players.find(p => p.id === targetId);
					if (target) {
						seerResult = {
							name: target.name,
							isWolf: target.role.team === 'wolf'
						};
						// 更新预言家的查验记录
						setPlayers(prev => prev.map(p =>
							p.id === seer.id
								? { ...p, seerResults: [...(p.seerResults || []), seerResult] }
								: p
						));
					}
				}
			}
		} else if (allSeer && isHumanSeer) {
			// 仅当玩家是预言家时显示死亡信息
			addLog(`预言家 ${allSeer.name} 已死亡`, 'seer');
		}
		addLog('预言家闭眼...', 'seer');

		await continueNightAfterSeer(killTarget, seerResult);
	}, [players, day, speeches, addLog]);

	// 预言家行动后继续
	const continueNightAfterSeer = useCallback(async (killTarget, seerResult) => {
		if (abortRef.current) return;

		const alivePlayers = getAlivePlayers(players);
		const humanPlayer = players.find(p => p.isHuman && p.isAlive);
		let witchActions = { healed: false, poisoned: null };

		// 3. 女巫用药
		const witch = alivePlayers.find(p => p.role.id === 'witch');
		const allWitch = players.find(p => p.role.id === 'witch');
		const isHumanWitch = humanPlayer?.role.id === 'witch';

		addLog('女巫睁眼...', 'witch');

		if (witch && (witch.witchPotion?.heal || witch.witchPotion?.poison)) {
			if (isHumanWitch) {
				const killedPlayer = killTarget ? players.find(p => p.id === killTarget) : null;
				setHumanAction({
					type: 'witch_action',
					targets: alivePlayers.filter(p => p.id !== humanPlayer.id),
					killedPlayer,
					canHeal: witch.witchPotion?.heal && killedPlayer,
					canPoison: witch.witchPotion?.poison,
					killTarget,
					seerResult
				});
				return;
			} else {
				// AI女巫决策 - 使用 DeepSeek API
				const killedPlayer = killTarget ? players.find(p => p.id === killTarget) : null;
				const poisonTargets = alivePlayers.filter(p => p.id !== witch.id);

				const gameState = {
					day,
					phase: 'night',
					alivePlayers,
					todaySpeeches: speeches,
					allSpeeches,
					players
				};

				const decision = await generateWitchDecision(witch, killedPlayer, poisonTargets, gameState);

				if (decision.useHeal) {
					witchActions.healed = true;
					setPlayers(prev => prev.map(p =>
						p.id === witch.id
							? { ...p, witchPotion: { ...p.witchPotion, heal: false } }
							: p
					));
				} else if (decision.usePoison && decision.poisonTarget) {
					const poisonedPlayer = players.find(p => p.id === decision.poisonTarget);
					witchActions.poisoned = decision.poisonTarget;
					setPlayers(prev => prev.map(p =>
						p.id === witch.id
							? { ...p, witchPotion: { ...p.witchPotion, poison: false } }
							: p
					));
				}
			}
		} else if (allWitch && !allWitch.isAlive && isHumanWitch) {
			// 仅当玩家是女巫时显示死亡信息
			addLog(`女巫 ${allWitch.name} 已死亡`, 'witch');
		} else if (witch && !witch.witchPotion?.heal && !witch.witchPotion?.poison && isHumanWitch) {
			// 仅当玩家是女巫时显示无药信息
			addLog('女巫已无药可用', 'witch');
		}
		addLog('女巫闭眼...', 'witch');

		await finalizeNight(killTarget, seerResult, witchActions);
	}, [players, day, speeches, addLog]);

	// 完成夜晚阶段
	const finalizeNight = useCallback(async (killTarget, seerResult, witchActions) => {
		if (abortRef.current) return;

		setIsProcessing(false);
		setHumanAction(null);

		// 处理死亡
		let deaths = [];
		if (killTarget && !witchActions.healed) {
			deaths.push(killTarget);
		}
		if (witchActions.poisoned && !deaths.includes(witchActions.poisoned)) {
			deaths.push(witchActions.poisoned);
		}

		// 更新玩家状态
		if (deaths.length > 0) {
			setPlayers(prev => prev.map(p =>
				deaths.includes(p.id) ? { ...p, isAlive: false } : p
			));
		}

		// 保存夜晚结果
		// 记录第一个死亡玩家的ID，用于确定发言顺序
		const firstDeathId = deaths.length > 0 ? deaths[0] : null;
		setNightActions({ killTarget, seerResult, witchActions, deaths, firstDeathId });
		setPhase(GAME_PHASES.NIGHT_RESULT);

	}, []);

	// 显示夜晚结果并进入白天
	const showNightResult = useCallback(() => {
		const { deaths, firstDeathId } = nightActions;

		addLog(`=== 第${day}天白天 ===`, 'phase');
		addLog('天亮了，请睁眼', 'system');

		if (deaths && deaths.length > 0) {
			deaths.forEach(id => {
				const deadPlayer = players.find(p => p.id === id);
				if (deadPlayer) {
					addLog(`💀 ${deadPlayer.name} 昨晚死亡`, 'death');
				}
			});
		} else {
			addLog('昨晚是平安夜，没有人死亡', 'info');
		}

		// 检查游戏是否结束
		const updatedPlayers = players.map(p =>
			(deaths || []).includes(p.id) ? { ...p, isAlive: false } : p
		);
		const result = checkGameOver(updatedPlayers);

		if (result.gameOver) {
			setGameResult(result);
			setPhase(GAME_PHASES.GAME_OVER);
			addLog(result.message, 'system');
		} else {
			setSpeeches([]);
			setPhase(GAME_PHASES.DAY_SPEECH);
			startDaySpeech(firstDeathId);
		}
	}, [nightActions, day, players, addLog]);

	// 开始白天发言
	const startDaySpeech = useCallback(async (firstDeathId = null) => {
		if (abortRef.current) return;

		const alivePlayers = getAlivePlayers(players);

		// 确定发言起始位置：从死亡玩家的下一位开始
		let startIndex = 0;
		if (firstDeathId !== null) {
			// 找到死亡玩家在原始玩家列表中的位置
			const deadPlayerIndex = players.findIndex(p => p.id === firstDeathId);
			if (deadPlayerIndex !== -1) {
				// 找到下一个存活玩家
				for (let offset = 1; offset <= players.length; offset++) {
					const nextIndex = (deadPlayerIndex + offset) % players.length;
					const nextPlayer = players[nextIndex];
					if (nextPlayer.isAlive) {
						startIndex = alivePlayers.findIndex(p => p.id === nextPlayer.id);
						break;
					}
				}
			}
		}

		setCurrentSpeaker(0);

		// 按顺序发言，从 startIndex 开始循环
		for (let i = 0; i < alivePlayers.length; i++) {
			if (abortRef.current) return;

			const speakerIndex = (startIndex + i) % alivePlayers.length;
			const speaker = alivePlayers[speakerIndex];
			setCurrentSpeaker(speaker.id);

			if (speaker.isHuman) {
				// 等待人类玩家发言，保存发言顺序信息
				// 构建完整的发言顺序列表
				const speakingOrder = alivePlayers.map((_, idx) => {
					const actualIdx = (startIndex + idx) % alivePlayers.length;
					return alivePlayers[actualIdx];
				});
				setHumanAction({ type: 'speech', speakerId: speaker.id, startIndex, currentIndex: i, totalSpeakers: alivePlayers.length, speakingOrder });
				return;
			} else {
				// AI发言，传入发言顺序信息
				// 构建完整的发言顺序列表
				const speakingOrder = alivePlayers.map((_, idx) => {
					const actualIdx = (startIndex + idx) % alivePlayers.length;
					return alivePlayers[actualIdx];
				});
				const speechOrder = { current: i + 1, total: alivePlayers.length, speakingOrder };
				await generateAndAddSpeech(speaker, speechOrder);
			}
		}

		// 发言结束，开始投票
		setCurrentSpeaker(null);
		setPhase(GAME_PHASES.DAY_VOTE);
		addLog('发言结束，开始投票', 'system');
	}, [players, addLog]);

	// 生成并添加AI发言
	const generateAndAddSpeech = useCallback(async (speaker, speechOrder = null) => {
		if (abortRef.current) return;
		setIsProcessing(true);

		try {
			const gameState = {
				day,
				phase: 'day',
				alivePlayers: getAlivePlayers(players),
				todaySpeeches: speeches,
				allSpeeches,
				players,
				lastNightDeath: nightActions.deaths?.map(id => players.find(p => p.id === id)?.name).join(', ') || null,
				speechOrder  // 发言顺序信息：{ current: 当前第几个, total: 共几人 }
			};

			const content = await generateAISpeech(speaker, gameState);

			const speechEntry = {
				playerId: speaker.id,
				playerName: speaker.name,
				content,
				day
			};

			setSpeeches(prev => [...prev, speechEntry]);
			setAllSpeeches(prev => [...prev, speechEntry]);

			addLog(`${speaker.name}: ${content}`, 'speech');
		} catch (error) {
			addLog(`${speaker.name} 发言失败: ${error.message}`, 'error');
		}

		setIsProcessing(false);
	}, [day, players, speeches, nightActions, addLog]);


	// 人类玩家发言
	const humanSpeak = useCallback(async (content) => {
		const speaker = players.find(p => p.isHuman);
		if (!speaker) return;

		const speechEntry = {
			playerId: speaker.id,
			playerName: speaker.name,
			content,
			day
		};

		setSpeeches(prev => [...prev, speechEntry]);
		setAllSpeeches(prev => [...prev, speechEntry]);

		addLog(`${speaker.name}: ${content}`, 'speech');

		// 保存当前的发言顺序信息
		const { startIndex, currentIndex, totalSpeakers, speakingOrder } = humanAction || { startIndex: 0, currentIndex: 0, totalSpeakers: 0, speakingOrder: [] };
		setHumanAction(null);

		// 继续后续AI发言
		const alivePlayers = getAlivePlayers(players);
		const total = totalSpeakers || alivePlayers.length;

		for (let i = currentIndex + 1; i < alivePlayers.length; i++) {
			if (abortRef.current) return;
			const speakerIndex = (startIndex + i) % alivePlayers.length;
			const nextSpeaker = alivePlayers[speakerIndex];
			setCurrentSpeaker(nextSpeaker.id);
			// 传入发言顺序信息
			const speechOrder = { current: i + 1, total, speakingOrder };
			await generateAndAddSpeech(nextSpeaker, speechOrder);
		}

		setCurrentSpeaker(null);
		setPhase(GAME_PHASES.DAY_VOTE);
		addLog('发言结束，开始投票', 'system');
	}, [players, day, humanAction, addLog, generateAndAddSpeech]);

	// 处理投票
	const processVotes = useCallback(async () => {
		if (abortRef.current) return;
		setIsProcessing(true);

		const alivePlayers = getAlivePlayers(players);
		const humanPlayer = alivePlayers.find(p => p.isHuman);
		const newVotes = {};

		const gameState = {
			day,
			phase: 'vote',
			alivePlayers,
			todaySpeeches: speeches,
			allSpeeches,
			players
		};

		// 记录已投票的AI玩家ID
		const votedPlayerIds = [];

		for (const voter of alivePlayers) {
			if (abortRef.current) return;

			if (voter.isHuman) {
				// 将已投票的AI结果传递给 humanAction
				setHumanAction({
					type: 'vote',
					targets: alivePlayers.filter(p => p.id !== voter.id),
					votedPlayerIds,  // 已投票的AI玩家ID列表
					previousVotes: { ...newVotes }  // 之前AI的投票结果
				});
				setIsProcessing(false);
				return;
			} else {
				const candidates = alivePlayers.filter(p => p.id !== voter.id);
				const voteTarget = await generateAIVote(voter, gameState, candidates);
				newVotes[voter.id] = voteTarget;
				votedPlayerIds.push(voter.id);
				addLog(`${voter.name} 投票完成`, 'vote');
			}
		}

		await finalizeVotes(newVotes);
	}, [players, day, speeches, addLog]);


	// 人类投票
	const humanVote = useCallback(async (targetId) => {
		const humanPlayer = players.find(p => p.isHuman);
		if (!humanPlayer) return;

		const alivePlayers = getAlivePlayers(players);
		const target = players.find(p => p.id === targetId);
		addLog(`${humanPlayer.name} 投票给 ${target?.name}`, 'vote');

		// 获取之前已投票的AI结果
		const { votedPlayerIds = [], previousVotes = {} } = humanAction || {};
		const newVotes = { ...previousVotes, [humanPlayer.id]: targetId };

		setHumanAction(null);
		setIsProcessing(true);

		const gameState = {
			day,
			phase: 'vote',
			alivePlayers,
			todaySpeeches: speeches,
			allSpeeches,
			players
		};

		// 只处理尚未投票的AI玩家
		for (const voter of alivePlayers) {
			if (abortRef.current) return;
			if (voter.isHuman) continue;
			// 跳过已经投过票的AI
			if (votedPlayerIds.includes(voter.id)) continue;

			const candidates = alivePlayers.filter(p => p.id !== voter.id);
			const voteTarget = await generateAIVote(voter, gameState, candidates);
			newVotes[voter.id] = voteTarget;
			addLog(`${voter.name} 投票完成`, 'vote');
		}

		await finalizeVotes(newVotes);
	}, [players, day, speeches, humanAction, addLog]);


	// 统计投票结果
	const finalizeVotes = useCallback(async (allVotes) => {
		setVotes(allVotes);
		setIsProcessing(false);

		// 统计票数
		const voteCount = {};
		Object.values(allVotes).forEach(targetId => {
			voteCount[targetId] = (voteCount[targetId] || 0) + 1;
		});

		// 找出最高票
		let maxVotes = 0;
		let eliminated = [];
		Object.entries(voteCount).forEach(([id, count]) => {
			if (count > maxVotes) {
				maxVotes = count;
				eliminated = [parseInt(id)];
			} else if (count === maxVotes) {
				eliminated.push(parseInt(id));
			}
		});

		// 如果平票，随机选择一个
		const eliminatedId = eliminated[Math.floor(Math.random() * eliminated.length)];
		const eliminatedPlayer = players.find(p => p.id === eliminatedId);

		// 显示投票结果
		addLog('--- 投票结果 ---', 'system');
		Object.entries(voteCount).forEach(([id, count]) => {
			const player = players.find(p => p.id === parseInt(id));
			addLog(`${player?.name}: ${count} 票`, 'vote');
		});

		if (eliminatedPlayer) {
			addLog(`${eliminatedPlayer.name} 被投票放逐`, 'death');

			// 更新玩家状态
			setPlayers(prev => prev.map(p =>
				p.id === eliminatedId ? { ...p, isAlive: false } : p
			));

			// 检查猎人技能
			if (eliminatedPlayer.role.id === 'hunter') {
				if (eliminatedPlayer.isHuman) {
					setHumanAction({
						type: 'hunter_shoot',
						targets: getAlivePlayers(players).filter(p => p.id !== eliminatedId)
					});
					return;
				} else {
					// AI猎人决策 - 使用 DeepSeek API
					const targets = getAlivePlayers(players).filter(p => p.id !== eliminatedId);
					if (targets.length > 0) {
						const gameState = {
							day,
							phase: 'vote',
							alivePlayers: targets,
							todaySpeeches: speeches,
							allSpeeches,
							players
						};

						const decision = await generateHunterShoot(eliminatedPlayer, targets, gameState, 'vote');

						if (decision.shouldShoot && decision.targetId) {
							const shootTarget = players.find(p => p.id === decision.targetId);
							addLog(`猎人开枪带走了 ${shootTarget?.name}！`, 'death');
							setPlayers(prev => prev.map(p =>
								p.id === decision.targetId ? { ...p, isAlive: false } : p
							));
						} else {
							addLog('猎人选择不开枪', 'info');
						}
					}
				}
			}
		}

		setPhase(GAME_PHASES.VOTE_RESULT);
	}, [players, day, speeches, addLog]);

	// 进入下一天
	const nextDay = useCallback(() => {
		// 检查游戏是否结束
		const result = checkGameOver(players);

		if (result.gameOver) {
			setGameResult(result);
			setPhase(GAME_PHASES.GAME_OVER);
			addLog(result.message, 'system');
		} else {
			setDay(prev => prev + 1);
			enterNight();
		}
	}, [players, addLog, enterNight]);

	// 人类夜晚行动
	const humanNightAction = useCallback(async (action, targetId) => {
		const humanPlayer = players.find(p => p.isHuman);
		if (!humanPlayer) return;

		switch (action) {
			case 'werewolf_kill': {
				addLog(`你选择杀死 ${players.find(p => p.id === targetId)?.name}`, 'wolf');
				setHumanAction(null);
				await continueNightAfterWerewolf(targetId);
				break;
			}

			case 'seer_check': {
				const target = players.find(p => p.id === targetId);
				const isWolf = target?.role.team === 'wolf';
				const seerResult = { name: target?.name, isWolf };

				addLog(`你查验了 ${target?.name}，ta是${isWolf ? '🐺 狼人' : '👤 好人'}`, 'seer');

				setPlayers(prev => prev.map(p =>
					p.isHuman && p.role.id === 'seer'
						? { ...p, seerResults: [...(p.seerResults || []), seerResult] }
						: p
				));

				setHumanAction(null);
				await continueNightAfterSeer(humanAction?.killTarget, seerResult);
				break;
			}

			case 'witch_heal': {
				// 仅显示给自己看，不在公共日志中显示
				setPlayers(prev => prev.map(p =>
					p.isHuman && p.role.id === 'witch'
						? { ...p, witchPotion: { ...p.witchPotion, heal: false } }
						: p
				));
				setHumanAction(null);
				await finalizeNight(humanAction?.killTarget, humanAction?.seerResult, { healed: true, poisoned: null });
				break;
			}

			case 'witch_poison': {
				const target = players.find(p => p.id === targetId);
				// 仅显示给自己看，不在公共日志中显示
				setPlayers(prev => prev.map(p =>
					p.isHuman && p.role.id === 'witch'
						? { ...p, witchPotion: { ...p.witchPotion, poison: false } }
						: p
				));
				setHumanAction(null);
				await finalizeNight(humanAction?.killTarget, humanAction?.seerResult, { healed: false, poisoned: targetId });
				break;
			}

			case 'witch_skip': {
				// 仅显示给自己看，不在公共日志中显示
				setHumanAction(null);
				await finalizeNight(humanAction?.killTarget, humanAction?.seerResult, { healed: false, poisoned: null });
				break;
			}

			case 'hunter_shoot': {
				const target = players.find(p => p.id === targetId);
				addLog(`你开枪带走了 ${target?.name}！`, 'death');
				setPlayers(prev => prev.map(p =>
					p.id === targetId ? { ...p, isAlive: false } : p
				));
				setHumanAction(null);
				setPhase(GAME_PHASES.VOTE_RESULT);
				break;
			}
		}
	}, [players, humanAction, addLog, continueNightAfterWerewolf, continueNightAfterSeer, finalizeNight]);

	// 重置游戏
	const resetGame = useCallback(() => {
		abortRef.current = true;
		setPlayers([]);
		setPhase(GAME_PHASES.SETUP);
		setDay(1);
		setLogs([]);
		setSpeeches([]);
		setAllSpeeches([]);
		setVotes({});
		setNightActions({});
		setGameResult(null);
		setHumanAction(null);
		setIsProcessing(false);
	}, []);

	return {
		// 状态
		players,
		phase,
		day,
		logs,
		speeches,
		allSpeeches,
		votes,
		currentSpeaker,
		gameResult,
		isProcessing,
		humanAction,
		nightActions,

		// 方法
		startGame,
		enterNight,
		processNightActions,
		showNightResult,
		processVotes,
		humanSpeak,
		humanVote,
		humanNightAction,
		nextDay,
		resetGame,
		addLog
	};
}
