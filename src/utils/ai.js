import OpenAI from "openai";
import { buildPersonalityPrompt } from "./personalities";

let openaiClient = null;

// 初始化 OpenAI 客户端 (用于 DeepSeek API)
export function initAI(apiKey) {
	openaiClient = new OpenAI({
		baseURL: 'https://api.deepseek.com',
		apiKey: apiKey,
		dangerouslyAllowBrowser: true
	});
	return openaiClient;
}

// 获取 AI 客户端
export function getAIClient() {
	return openaiClient;
}

// 验证 API Key 是否有效
export async function validateAPIKey(apiKey) {
	try {
		const testClient = new OpenAI({
			baseURL: 'https://api.deepseek.com',
			apiKey: apiKey,
			dangerouslyAllowBrowser: true
		});

		const completion = await testClient.chat.completions.create({
			model: 'deepseek-chat',
			messages: [
				{ role: 'user', content: '你好' }
			],
			max_tokens: 5
		});

		return { success: true, message: 'API Key 验证成功！' };
	} catch (error) {
		console.error('API Key 验证失败:', error);
		let errorMessage = 'API Key 验证失败';
		if (error.status === 401) {
			errorMessage = 'API Key 无效，请检查后重试';
		} else if (error.status === 429) {
			errorMessage = 'API 请求过于频繁，请稍后再试';
		} else if (error.message) {
			errorMessage = error.message;
		}
		return { success: false, message: errorMessage };
	}
}

// 构建游戏上下文信息（包含历史发言和场上状态）
function buildGameContext(gameState) {
	const { day, alivePlayers, allSpeeches, players, todaySpeeches } = gameState;

	// 获取已死亡的玩家
	const deadPlayers = (players || []).filter(p => !p.isAlive);

	// 格式化玩家名字（加上序号）
	const formatPlayerName = (player) => `${player.name} #${player.id + 1}`;

	// 格式化历史发言（按天分组）
	const formatHistoricalSpeeches = () => {
		if (!allSpeeches || allSpeeches.length === 0) {
			return '暂无历史发言记录';
		}

		// 按天分组
		const speechesByDay = {};
		allSpeeches.forEach(s => {
			if (!speechesByDay[s.day]) {
				speechesByDay[s.day] = [];
			}
			speechesByDay[s.day].push(s);
		});

		// 格式化输出
		let result = '';
		Object.keys(speechesByDay).sort((a, b) => a - b).forEach(d => {
			result += `\n【第${d}天发言】\n`;
			speechesByDay[d].forEach(s => {
				// 根据 playerId 查找玩家获取序号
				const player = (players || []).find(p => p.id === s.playerId);
				const playerLabel = player ? formatPlayerName(player) : s.playerName;
				result += `${playerLabel}: ${s.content}\n`;
			});
		});

		return result.trim();
	};

	// 格式化今天的发言
	const formatTodaySpeeches = () => {
		if (!todaySpeeches || todaySpeeches.length === 0) {
			return '今天暂无发言';
		}
		return todaySpeeches.map(s => {
			const player = (players || []).find(p => p.id === s.playerId);
			const playerLabel = player ? formatPlayerName(player) : s.playerName;
			return `${playerLabel}: ${s.content}`;
		}).join('\n');
	};

	return {
		currentDay: day,
		alivePlayerNames: alivePlayers.map(p => formatPlayerName(p)).join(', '),
		alivePlayerCount: alivePlayers.length,
		deadPlayerNames: deadPlayers.length > 0 ? deadPlayers.map(p => formatPlayerName(p)).join(', ') : '无',
		deadPlayerCount: deadPlayers.length,
		historicalSpeeches: formatHistoricalSpeeches(),
		todaySpeeches: formatTodaySpeeches()
	};
}

// 构建角色系统提示词
function buildSystemPrompt(player, gameState) {
	const context = buildGameContext(gameState);

	const rolePrompts = {
		werewolf: `你是一名狼人玩家，你的名字是${player.name}。你的队友是另一名狼人。
你的目标是隐藏自己的身份，误导村民，并在投票中除掉威胁。
发言时要表现得像一个普通村民或神职，不要暴露自己是狼人。
如果被怀疑，要巧妙地辩解或转移怀疑到其他人身上。`,

		seer: `你是预言家，你的名字是${player.name}。
你每晚可以查验一名玩家的身份。你的查验结果：${JSON.stringify(player.seerResults || [])}
你的目标是找出狼人并引导村民投票消灭狼人。
发言时要分享你的查验信息，但要注意自己的安全，避免被狼人第一时间杀掉。`,

		witch: `你是女巫，你的名字是${player.name}。
你有一瓶解药(${player.witchPotion?.heal ? '未使用' : '已使用'})和一瓶毒药(${player.witchPotion?.poison ? '未使用' : '已使用'})。
发言时要分析场上局势，帮助好人找出狼人。`,

		hunter: `你是猎人，你的名字是${player.name}。
你死亡时可以开枪带走一名玩家。
发言时要积极参与讨论，分析谁是狼人。`,

		villager: `你是村民，你的名字是${player.name}。
你没有特殊技能，但你可以通过分析发言找出狼人。
发言时要认真分析其他人的发言，找出可疑的人。`
	};

	// 获取人设提示词
	const personalityPrompt = buildPersonalityPrompt(player.personality);

	// 发言顺序信息
	let speechOrderInfo = '';
	if (gameState.speechOrder) {
		const { current, total, speakingOrder } = gameState.speechOrder;

		// 构建完整的发言顺序列表
		let orderList = '';
		if (speakingOrder && speakingOrder.length > 0) {
			orderList = speakingOrder.map((p, idx) => {
				const marker = idx + 1 === current ? '→' : ' ';
				const status = idx + 1 < current ? '(已发言)' : (idx + 1 === current ? '(当前)' : '(未发言)');
				return `${marker} ${idx + 1}. ${p.name} #${p.id + 1} ${status}`;
			}).join('\n');
		}

		speechOrderInfo = `\n=== 本轮发言顺序 ===
${orderList}

你是第 ${current} 个发言的玩家（共 ${total} 人）。`;
		if (current < total) {
			speechOrderInfo += `
排在你后面的玩家尚未发言，他们不是沉默，只是还没轮到。请不要质疑尚未发言的玩家为什么不说话。`;
		}
	}

	return `你正在玩一个8人狼人杀游戏。这是第${gameState.day}天${gameState.phase === 'day' ? '白天' : '夜晚'}。

${rolePrompts[player.role.id]}
${personalityPrompt}

=== 当前场上状态 ===
存活玩家(${context.alivePlayerCount}人): ${context.alivePlayerNames}
已死亡玩家: ${context.deadPlayerNames}
${gameState.lastNightDeath ? `昨晚死亡: ${gameState.lastNightDeath}` : ''}
${gameState.lastVoteDeath ? `上次投票放逐: ${gameState.lastVoteDeath}` : ''}
${speechOrderInfo}

=== 所有历史发言记录 ===
${context.historicalSpeeches}

请发表你的看法，要有个人特色，可以怀疑某人或为自己辩护。发言要像真人玩家一样，可长可短，根据当前局势自由决定发言内容和长度，并且要结合历史发言分析场上局势，符合你的人设性格和说话风格。

【重要提示】这是一个纯语言游戏，你的发言只需要包含说话内容，不要描述任何动作、表情、肢体语言或心理活动（如"*皱眉*"、"（沉思）"、"露出笑容"等）,也不要有任何与本游戏无关的描述。直接说出你要表达的话即可。`;
}

// 构建投票系统提示词
function buildVotePrompt(player, gameState, candidates) {
	const context = buildGameContext(gameState);

	const roleHints = {
		werewolf: `作为狼人，你应该投票给对狼人阵营威胁最大的人，或者跟随多数投票避免暴露。
看情况也可以投给自己的狼人队友，以迷惑好人。`,
		seer: `作为预言家，根据你的查验结果投票。如果查到狼人就投他。`,
		witch: `作为女巫，分析场上局势决定投票。`,
		hunter: `作为猎人，分析场上局势决定投票。`,
		villager: `作为村民，分析发言决定投票。`
	};

	return `你需要投票放逐一名玩家。

${roleHints[player.role.id]}

=== 当前场上状态 ===
存活玩家(${context.alivePlayerCount}人): ${context.alivePlayerNames}
已死亡玩家: ${context.deadPlayerNames}
可选择投票的玩家: ${candidates.map(p => p.name).join(', ')}

=== 所有历史发言记录 ===
${context.historicalSpeeches}

请根据以上所有发言记录分析，找出最可疑的人。只回复你要投票的玩家名字，不要说其他话。`;
}

// 生成 AI 发言
export async function generateAISpeech(player, gameState) {
	if (!openaiClient) {
		throw new Error('AI 客户端未初始化，请先输入 API Key');
	}

	try {
		const completion = await openaiClient.chat.completions.create({
			model: 'deepseek-chat',
			messages: [
				{ role: 'system', content: buildSystemPrompt(player, gameState) },
				{ role: 'user', content: '现在轮到你发言了，请发表你的看法。' }
			],
			max_tokens: 150,
			temperature: 0.8
		});

		let content = completion.choices[0].message.content;

		// 后处理：替换发言中的玩家名字为带序号格式
		const allPlayers = gameState.players || [];
		// 按名字长度降序排列，避免短名字先被替换导致长名字替换不完整
		const sortedPlayers = [...allPlayers].sort((a, b) => b.name.length - a.name.length);
		for (const p of sortedPlayers) {
			// 只替换没有序号的玩家名字（避免重复添加序号）
			const nameWithNumber = `${p.name} #${p.id + 1}`;
			// 使用正则匹配玩家名字，但排除已经带序号的情况
			const regex = new RegExp(`${p.name}(?! #\\d+)`, 'g');
			content = content.replace(regex, nameWithNumber);
		}

		return content;
	} catch (error) {
		console.error('AI 发言生成失败:', error);
		throw error;
	}
}

// 生成 AI 投票决策
export async function generateAIVote(player, gameState, candidates) {
	if (!openaiClient) {
		throw new Error('AI 客户端未初始化');
	}

	try {
		const completion = await openaiClient.chat.completions.create({
			model: 'deepseek-chat',
			messages: [
				{ role: 'system', content: buildSystemPrompt(player, gameState) },
				{ role: 'user', content: buildVotePrompt(player, gameState, candidates) }
			],
			max_tokens: 20,
			temperature: 0.3
		});

		const voteText = completion.choices[0].message.content.trim();
		// 尝试匹配玩家名字
		const votedPlayer = candidates.find(p => voteText.includes(p.name));
		return votedPlayer ? votedPlayer.id : candidates[Math.floor(Math.random() * candidates.length)].id;
	} catch (error) {
		console.error('AI 投票失败:', error);
		// 失败时随机投票
		return candidates[Math.floor(Math.random() * candidates.length)].id;
	}
}

// 生成狼人杀人决策
export async function generateWerewolfKill(werewolves, targets, gameState) {
	if (!openaiClient || werewolves.length === 0) {
		return targets[Math.floor(Math.random() * targets.length)].id;
	}

	try {
		const context = buildGameContext(gameState);
		const wolf = werewolves[0]; // 使用第一个狼人做决策

		const prompt = `你是狼人，需要选择今晚杀死的目标。优先考虑杀死预言家或女巫等神职。

=== 当前场上状态 ===
存活玩家(${context.alivePlayerCount}人): ${context.alivePlayerNames}
已死亡玩家: ${context.deadPlayerNames}
可选目标: ${targets.map(p => p.name).join(', ')}

=== 所有历史发言记录 ===
${context.historicalSpeeches}

请根据以上发言分析，找出最可能是神职的玩家。选择今晚杀死谁？只回复玩家名字。`;

		const completion = await openaiClient.chat.completions.create({
			model: 'deepseek-chat',
			messages: [
				{ role: 'system', content: prompt },
				{ role: 'user', content: '选择今晚杀死谁？只回复玩家名字。' }
			],
			max_tokens: 20,
			temperature: 0.5
		});

		const killText = completion.choices[0].message.content.trim();
		const target = targets.find(p => killText.includes(p.name));
		return target ? target.id : targets[Math.floor(Math.random() * targets.length)].id;
	} catch (error) {
		console.error('狼人决策失败:', error);
		return targets[Math.floor(Math.random() * targets.length)].id;
	}
}

// 生成预言家查验决策
export async function generateSeerCheck(seer, targets, gameState) {
	if (!openaiClient) {
		return targets[Math.floor(Math.random() * targets.length)].id;
	}

	try {
		const context = buildGameContext(gameState);

		const prompt = `你是预言家，需要选择今晚查验的目标。优先查验可疑的人。

=== 当前场上状态 ===
存活玩家(${context.alivePlayerCount}人): ${context.alivePlayerNames}
已死亡玩家: ${context.deadPlayerNames}
已查验过的玩家: ${(seer.seerResults || []).map(r => `${r.name}(是${r.isWolf ? '狼人' : '好人'})`).join(', ') || '无'}
可选目标: ${targets.map(p => p.name).join(', ')}

=== 所有历史发言记录 ===
${context.historicalSpeeches}

请根据以上发言分析，找出最可疑的玩家进行查验。选择今晚查验谁？只回复玩家名字。`;

		const completion = await openaiClient.chat.completions.create({
			model: 'deepseek-chat',
			messages: [
				{ role: 'system', content: prompt },
				{ role: 'user', content: '选择今晚查验谁？只回复玩家名字。' }
			],
			max_tokens: 20,
			temperature: 0.5
		});

		const checkText = completion.choices[0].message.content.trim();
		const target = targets.find(p => checkText.includes(p.name));
		return target ? target.id : targets[Math.floor(Math.random() * targets.length)].id;
	} catch (error) {
		console.error('预言家决策失败:', error);
		return targets[Math.floor(Math.random() * targets.length)].id;
	}
}

// 生成女巫用药决策
export async function generateWitchDecision(witch, killedPlayer, poisonTargets, gameState) {
	if (!openaiClient) {
		// 默认逻辑：70%概率救人，不使用毒药
		return {
			useHeal: witch.witchPotion?.heal && killedPlayer && Math.random() > 0.3,
			usePoison: false,
			poisonTarget: null
		};
	}

	try {
		const context = buildGameContext(gameState);
		const canHeal = witch.witchPotion?.heal && killedPlayer;
		const canPoison = witch.witchPotion?.poison && poisonTargets.length > 0;

		let prompt = `你是女巫，你的名字是${witch.name}。现在是夜晚，你需要决定是否使用药水。

=== 当前情况 ===
- 解药: ${witch.witchPotion?.heal ? '有' : '已使用'}
- 毒药: ${witch.witchPotion?.poison ? '有' : '已使用'}
${killedPlayer ? `- 今晚被狼人杀死的玩家: ${killedPlayer.name}` : '- 今晚没有人被狼人杀死'}
${canPoison ? `- 可以毒杀的玩家: ${poisonTargets.map(p => p.name).join(', ')}` : ''}

=== 当前场上状态 ===
存活玩家(${context.alivePlayerCount}人): ${context.alivePlayerNames}
已死亡玩家: ${context.deadPlayerNames}

=== 所有历史发言记录 ===
${context.historicalSpeeches}

请根据以上发言分析局势做出决策。回复格式必须严格按照以下格式之一：
1. 如果要救人: "救人"
2. 如果要毒杀某人: "毒杀 [玩家名字]"
3. 如果不使用药水: "不使用"

注意事项：
- 解药很珍贵，不要轻易使用，尤其是在游戏初期不确定被杀者身份时
- 毒药要用在确定是狼人的玩家身上
- 如果不确定，可以选择不使用

请只回复你的决策，不要说其他话。`;

		const completion = await openaiClient.chat.completions.create({
			model: 'deepseek-chat',
			messages: [
				{ role: 'system', content: prompt },
				{ role: 'user', content: '请做出你的决策。' }
			],
			max_tokens: 50,
			temperature: 0.6
		});

		const decision = completion.choices[0].message.content.trim();
		console.log('女巫AI决策:', decision);

		// 解析决策
		if (decision.includes('救人') && canHeal) {
			return { useHeal: true, usePoison: false, poisonTarget: null };
		} else if (decision.includes('毒杀') && canPoison) {
			const poisonTarget = poisonTargets.find(p => decision.includes(p.name));
			if (poisonTarget) {
				return { useHeal: false, usePoison: true, poisonTarget: poisonTarget.id };
			}
		}

		// 默认不使用
		return { useHeal: false, usePoison: false, poisonTarget: null };
	} catch (error) {
		console.error('女巫决策失败:', error);
		return { useHeal: false, usePoison: false, poisonTarget: null };
	}
}

// 生成猎人开枪决策
export async function generateHunterShoot(hunter, targets, gameState, deathReason) {
	if (!openaiClient || targets.length === 0) {
		// 默认选择第一个目标
		return { shouldShoot: true, targetId: targets[0]?.id };
	}

	try {
		const context = buildGameContext(gameState);

		const prompt = `你是猎人，你的名字是${hunter.name}。你刚刚${deathReason === 'vote' ? '被投票放逐' : '被狼人杀死'}了！

作为猎人，你死亡时有开枪带走一名玩家的技能。你需要决定是否开枪，以及开枪的目标。

=== 当前场上状态 ===
存活玩家(${context.alivePlayerCount}人): ${context.alivePlayerNames}
已死亡玩家: ${context.deadPlayerNames}
可选目标: ${targets.map(p => p.name).join(', ')}

=== 所有历史发言记录 ===
${context.historicalSpeeches}

请根据以上所有发言分析谁最可能是狼人，做出决策。回复格式必须严格按照以下格式之一：
1. 如果要开枪: "开枪 [玩家名字]"
2. 如果不开枪（非常不推荐，因为浪费技能）: "不开枪"

作为好人阵营，你应该尽量带走一个狼人。请根据发言分析最可疑的人。

请只回复你的决策，不要说其他话。`;

		const completion = await openaiClient.chat.completions.create({
			model: 'deepseek-chat',
			messages: [
				{ role: 'system', content: prompt },
				{ role: 'user', content: '请做出你的决策。' }
			],
			max_tokens: 50,
			temperature: 0.5
		});

		const decision = completion.choices[0].message.content.trim();
		console.log('猎人AI决策:', decision);

		// 解析决策
		if (decision.includes('不开枪')) {
			return { shouldShoot: false, targetId: null };
		} else if (decision.includes('开枪')) {
			const target = targets.find(p => decision.includes(p.name));
			if (target) {
				return { shouldShoot: true, targetId: target.id };
			}
			// 如果没有匹配到名字，随机选择一个
			return { shouldShoot: true, targetId: targets[Math.floor(Math.random() * targets.length)].id };
		}

		// 默认开枪带走随机目标
		return { shouldShoot: true, targetId: targets[Math.floor(Math.random() * targets.length)].id };
	} catch (error) {
		console.error('猎人决策失败:', error);
		return { shouldShoot: true, targetId: targets[Math.floor(Math.random() * targets.length)].id };
	}
}

// 生成游戏结束分析
export async function generateGameAnalysis(players, allSpeeches, gameResult) {
	if (!openaiClient) {
		return '无法生成游戏分析：AI 客户端未初始化';
	}

	try {
		// 格式化所有玩家信息（包含真实身份）
		const formatPlayerInfo = () => {
			return players.map(p => {
				const statusIcon = p.isAlive ? '✓存活' : '✗死亡';
				const humanTag = p.isHuman ? '【玩家】' : '';
				return `${p.name}${humanTag}: ${p.role.emoji}${p.role.name} (${statusIcon})`;
			}).join('\n');
		};

		// 格式化所有历史发言（按天分组）
		const formatAllSpeeches = () => {
			if (!allSpeeches || allSpeeches.length === 0) {
				return '无发言记录';
			}

			const speechesByDay = {};
			allSpeeches.forEach(s => {
				if (!speechesByDay[s.day]) {
					speechesByDay[s.day] = [];
				}
				speechesByDay[s.day].push(s);
			});

			let result = '';
			Object.keys(speechesByDay).sort((a, b) => a - b).forEach(d => {
				result += `\n【第${d}天发言】\n`;
				speechesByDay[d].forEach(s => {
					const player = players.find(p => p.id === s.playerId);
					const roleInfo = player ? `[${player.role.name}]` : '';
					result += `${s.playerName}${roleInfo}: ${s.content}\n`;
				});
			});

			return result.trim();
		};

		const prompt = `你是一位专业的狼人杀游戏分析师。请根据以下游戏信息，给出一份详细、专业的游戏分析报告。

=== 游戏结果 ===
${gameResult.winner === 'good' ? '🎉 好人阵营胜利' : '🐺 狼人阵营胜利'}
${gameResult.message}

=== 所有玩家身份 ===
${formatPlayerInfo()}

=== 完整发言记录 ===
${formatAllSpeeches()}

请从以下几个方面进行分析：

1. **游戏概述**：简述这局游戏的大致走向和胜负关键

2. **狼人表现分析**：
   - 狼人的隐藏和伪装策略如何？
   - 狼人杀人选择是否合理？
   - 狼人发言有哪些破绽或亮点？

3. **神职表现分析**：
   - 预言家/女巫/猎人的发言和操作是否得当？
   - 有没有正确引导村民？

4. **关键回合分析**：
   - 哪些回合的发言或投票是决定胜负的关键？
   - 有没有精彩的博弈或失误？

5. **玩家建议**：
   - 针对玩家（标注【玩家】的那位）的表现给出具体建议
   - 玩家做得好的地方和需要改进的地方

请用清晰的结构输出分析，语言要专业但易懂，像一位经验丰富的狼人杀主持人在复盘。`;

		const completion = await openaiClient.chat.completions.create({
			model: 'deepseek-chat',
			messages: [
				{ role: 'system', content: '你是一位专业的狼人杀游戏分析师，擅长复盘分析和给出建议。' },
				{ role: 'user', content: prompt }
			],
			max_tokens: 1500,
			temperature: 0.7
		});

		return completion.choices[0].message.content;
	} catch (error) {
		console.error('游戏分析生成失败:', error);
		return '游戏分析生成失败：' + error.message;
	}
}
