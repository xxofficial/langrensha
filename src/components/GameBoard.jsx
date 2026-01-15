import { useState } from 'react';
import { PlayerCard } from './PlayerCard';
import { ChatLog } from './ChatLog';
import { useGame, GAME_PHASES } from '../hooks/useGame';
import { initAI } from '../utils/ai';
import './GameBoard.css';

export function GameBoard() {
	const [apiKey, setApiKey] = useState('');
	const [apiKeySet, setApiKeySet] = useState(false);
	const [speechInput, setSpeechInput] = useState('');
	const [selectedPlayer, setSelectedPlayer] = useState(null);

	const {
		players,
		phase,
		day,
		logs,
		speeches,
		currentSpeaker,
		gameResult,
		isProcessing,
		humanAction,
		nightActions,
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
		allSpeeches
	} = useGame();

	// 设置 API Key
	const handleSetApiKey = () => {
		if (apiKey.trim()) {
			try {
				initAI(apiKey.trim());
				setApiKeySet(true);
			} catch (error) {
				alert('API Key 设置失败: ' + error.message);
			}
		}
	};

	// 人类玩家发言
	const handleSpeak = () => {
		if (speechInput.trim()) {
			humanSpeak(speechInput.trim());
			setSpeechInput('');
		}
	};

	// 渲染设置页面
	const renderSetup = () => (
		<div className="setup-container">
			<div className="setup-card">
				<h1 className="game-title">🐺 狼人杀</h1>
				<p className="game-subtitle">1名玩家 + 7名AI玩家</p>

				{!apiKeySet ? (
					<div className="api-setup">
						<div className="input-group">
							<label>DeepSeek API Key</label>
							<input
								type="password"
								value={apiKey}
								onChange={(e) => setApiKey(e.target.value)}
								placeholder="输入你的 API Key"
								onKeyDown={(e) => e.key === 'Enter' && handleSetApiKey()}
							/>
						</div>
						<button className="btn-primary" onClick={handleSetApiKey}>
							确认
						</button>
						<p className="api-hint">
							💡 API Key 仅用于调用 DeepSeek AI 生成发言
						</p>
					</div>
				) : (
					<div className="start-section">
						<div className="api-status">✅ API Key 已设置</div>
						<button className="btn-start" onClick={startGame}>
							开始游戏
						</button>
					</div>
				)}
			</div>
		</div>
	);

	// 渲染角色展示
	const renderRoleReveal = () => {
		const humanPlayer = players.find(p => p.isHuman);
		return (
			<div className="role-reveal">
				<div className="reveal-card">
					<h2>你的身份</h2>
					<div className="role-emoji">{humanPlayer?.role.emoji}</div>
					<div className="role-name">{humanPlayer?.role.name}</div>
					<div className="role-desc">{humanPlayer?.role.description}</div>
					{humanPlayer?.role.id === 'werewolf' && (
						<div className="teammate-info">
							🐺 你的队友: {players.find(p => p.role.id === 'werewolf' && !p.isHuman)?.name}
						</div>
					)}
					<button className="btn-primary" onClick={enterNight}>
						进入夜晚
					</button>
				</div>
			</div>
		);
	};

	// 渲染夜晚阶段
	const renderNight = () => (
		<div className="night-phase">
			<div className="phase-header night">
				<span className="phase-icon">🌙</span>
				<span>第{day}天夜晚</span>
			</div>
			<div className="night-content">
				<p>天黑请闭眼...</p>
				<button
					className="btn-primary"
					onClick={processNightActions}
					disabled={isProcessing}
				>
					{isProcessing ? '处理中...' : '开始夜晚行动'}
				</button>
			</div>
		</div>
	);

	// 渲染人类夜晚行动
	const renderHumanNightAction = () => {
		if (!humanAction) return null;

		switch (humanAction.type) {
			case 'werewolf_kill':
				return (
					<div className="action-panel wolf-action">
						<h3>🐺 选择今晚击杀的目标</h3>
						<div className="target-grid">
							{humanAction.targets.map(target => (
								<button
									key={target.id}
									className="target-btn"
									onClick={() => humanNightAction('werewolf_kill', target.id)}
								>
									{target.name}
								</button>
							))}
						</div>
					</div>
				);

			case 'seer_check':
				return (
					<div className="action-panel seer-action">
						<h3>🔮 选择今晚查验的目标</h3>
						<div className="target-grid">
							{humanAction.targets.map(target => (
								<button
									key={target.id}
									className="target-btn"
									onClick={() => humanNightAction('seer_check', target.id)}
								>
									{target.name}
								</button>
							))}
						</div>
					</div>
				);

			case 'witch_action':
				return (
					<div className="action-panel witch-action">
						<h3>🧙‍♀️ 女巫行动</h3>
						{humanAction.canHeal && humanAction.killedPlayer && (
							<div className="witch-option">
								<p>今晚 {humanAction.killedPlayer.name} 被杀</p>
								<button
									className="target-btn heal"
									onClick={() => humanNightAction('witch_heal')}
								>
									使用解药救人
								</button>
							</div>
						)}
						{humanAction.canPoison && (
							<div className="witch-option">
								<p>选择毒杀目标:</p>
								<div className="target-grid">
									{humanAction.targets.map(target => (
										<button
											key={target.id}
											className="target-btn poison"
											onClick={() => humanNightAction('witch_poison', target.id)}
										>
											{target.name}
										</button>
									))}
								</div>
							</div>
						)}
						<button
							className="btn-secondary"
							onClick={() => humanNightAction('witch_skip')}
						>
							不使用药水
						</button>
					</div>
				);

			case 'hunter_shoot':
				return (
					<div className="action-panel hunter-action">
						<h3>🏹 你被放逐了！选择开枪目标</h3>
						<div className="target-grid">
							{humanAction.targets.map(target => (
								<button
									key={target.id}
									className="target-btn"
									onClick={() => humanNightAction('hunter_shoot', target.id)}
								>
									{target.name}
								</button>
							))}
						</div>
					</div>
				);

			default:
				return null;
		}
	};

	// 渲染夜晚结果
	const renderNightResult = () => (
		<div className="night-result">
			<div className="phase-header day">
				<span className="phase-icon">☀️</span>
				<span>第{day}天白天</span>
			</div>
			<button className="btn-primary" onClick={showNightResult}>
				查看昨晚信息
			</button>
		</div>
	);

	// 渲染白天发言
	const renderDaySpeech = () => (
		<div className="day-speech">
			<div className="phase-header day">
				<span className="phase-icon">💬</span>
				<span>第{day}天 - 发言阶段</span>
			</div>

			{humanAction?.type === 'speech' ? (
				<div className="speech-input-container">
					<textarea
						value={speechInput}
						onChange={(e) => setSpeechInput(e.target.value)}
						placeholder="轮到你发言了，说点什么..."
						rows={3}
					/>
					<button className="btn-primary" onClick={handleSpeak}>
						发言
					</button>
				</div>
			) : (
				<div className="waiting-speech">
					{isProcessing ? 'AI 正在思考...' : '等待其他玩家发言...'}
				</div>
			)}
		</div>
	);

	// 渲染投票阶段
	const renderVoting = () => (
		<div className="voting-phase">
			<div className="phase-header vote">
				<span className="phase-icon">🗳️</span>
				<span>投票阶段</span>
			</div>

			{humanAction?.type === 'vote' ? (
				<div className="vote-panel">
					<h3>选择要放逐的玩家</h3>
					<div className="vote-grid">
						{humanAction.targets.map(target => (
							<button
								key={target.id}
								className="vote-btn"
								onClick={() => humanVote(target.id)}
							>
								{target.name}
							</button>
						))}
					</div>
				</div>
			) : (
				<div className="vote-actions">
					{!isProcessing ? (
						<button className="btn-primary" onClick={processVotes}>
							开始投票
						</button>
					) : (
						<div className="waiting-vote">AI 正在投票...</div>
					)}
				</div>
			)}
		</div>
	);

	// 渲染投票结果
	const renderVoteResult = () => (
		<div className="vote-result">
			<div className="phase-header">
				<span className="phase-icon">📊</span>
				<span>投票结果</span>
			</div>
			<button className="btn-primary" onClick={nextDay}>
				进入下一轮
			</button>
		</div>
	);

	// 渲染游戏结束
	const renderGameOver = () => (
		<div className="game-over">
			<div className={`result-card ${gameResult?.winner}`}>
				<h2>{gameResult?.winner === 'good' ? '🎉 好人胜利!' : '🐺 狼人胜利!'}</h2>
				<p>{gameResult?.message}</p>
				<div className="final-roles">
					<h3>玩家身份</h3>
					<div className="roles-grid">
						{players.map(p => (
							<div key={p.id} className={`role-item ${p.isAlive ? 'alive' : 'dead'}`}>
								<span>{p.role.emoji}</span>
								<span>{p.name}</span>
								<span>{p.role.name}</span>
							</div>
						))}
					</div>
				</div>
				<button className="btn-primary" onClick={resetGame}>
					重新开始
				</button>
			</div>
		</div>
	);

	// 渲染主游戏区域
	const renderGameContent = () => {
		switch (phase) {
			case GAME_PHASES.SETUP:
				return renderSetup();
			case GAME_PHASES.ROLE_REVEAL:
				return renderRoleReveal();
			case GAME_PHASES.NIGHT:
				return humanAction ? renderHumanNightAction() : renderNight();
			case GAME_PHASES.NIGHT_RESULT:
				return renderNightResult();
			case GAME_PHASES.DAY_SPEECH:
				return renderDaySpeech();
			case GAME_PHASES.DAY_VOTE:
				return renderVoting();
			case GAME_PHASES.VOTE_RESULT:
				return humanAction ? renderHumanNightAction() : renderVoteResult();
			case GAME_PHASES.GAME_OVER:
				return renderGameOver();
			default:
				return null;
		}
	};

	// 主渲染
	if (phase === GAME_PHASES.SETUP) {
		return renderSetup();
	}

	return (
		<div className="game-board">
			<header className="game-header">
				<h1>🐺 狼人杀</h1>
				<div className="game-info">
					<span className="day-counter">第 {day} 天</span>
					<span className="phase-indicator">
						{phase.includes('night') ? '🌙 夜晚' : '☀️ 白天'}
					</span>
				</div>
				<button className="btn-reset" onClick={resetGame}>重新开始</button>
			</header>

			<div className="game-main">
				<div className="players-section">
					<div className="players-grid">
						{players.map(player => (
							<PlayerCard
								key={player.id}
								player={player}
								isCurrentSpeaker={currentSpeaker === player.id}
								showRole={phase === GAME_PHASES.GAME_OVER}
								onViewHistory={(p) => setSelectedPlayer(p)}
							/>
						))}
					</div>
				</div>

				<div className="content-section">
					<div className="action-area">
						{renderGameContent()}
					</div>
					<ChatLog logs={logs} />
				</div>
			</div>

			{/* 发言历史弹窗 */}
			{selectedPlayer && (
				<div className="speech-history-modal" onClick={() => setSelectedPlayer(null)}>
					<div className="speech-history-content" onClick={(e) => e.stopPropagation()}>
						<div className="speech-history-header">
							<h3>{selectedPlayer.name} 的发言记录</h3>
							<button className="close-btn" onClick={() => setSelectedPlayer(null)}>✕</button>
						</div>
						<div className="speech-history-list">
							{allSpeeches
								.filter(s => s.playerId === selectedPlayer.id)
								.map((speech, index) => (
									<div key={index} className="speech-history-item">
										<div className="speech-day">第{speech.day}天</div>
										<div className="speech-content">{speech.content}</div>
									</div>
								))
							}
							{allSpeeches.filter(s => s.playerId === selectedPlayer.id).length === 0 && (
								<div className="no-speech">该玩家暂无发言记录</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
