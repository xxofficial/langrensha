import { useRef, useEffect } from 'react';
import './ChatLog.css';

export function ChatLog({ logs, players = [] }) {
	const logEndRef = useRef(null);

	useEffect(() => {
		logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [logs]);

	const getLogClass = (type) => {
		const typeClasses = {
			system: 'log-system',
			phase: 'log-phase',
			speech: 'log-speech',
			vote: 'log-vote',
			death: 'log-death',
			wolf: 'log-wolf',
			seer: 'log-seer',
			witch: 'log-witch',
			error: 'log-error',
			info: 'log-info'
		};
		return typeClasses[type] || 'log-info';
	};

	// 高亮显示消息中的玩家名字
	const highlightPlayerNames = (message) => {
		if (!players || players.length === 0) {
			return message;
		}

		// 创建玩家名字到颜色的映射
		const playerColorMap = {};
		players.forEach(p => {
			playerColorMap[p.name] = p.color;
		});

		// 按名字长度降序排序（避免短名字先匹配导致问题）
		const sortedNames = Object.keys(playerColorMap).sort((a, b) => b.length - a.length);

		if (sortedNames.length === 0) {
			return message;
		}

		// 创建正则表达式匹配所有玩家名字
		const regex = new RegExp(`(${sortedNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');

		// 分割消息并为玩家名字添加颜色
		const parts = message.split(regex);

		return parts.map((part, index) => {
			const color = playerColorMap[part];
			if (color) {
				return (
					<span key={index} className="player-name-highlight" style={{ color: color, fontWeight: 600 }}>
						{part}
					</span>
				);
			}
			return part;
		});
	};

	return (
		<div className="chat-log">
			<div className="chat-log-header">
				<span className="chat-log-icon">📜</span>
				<span>游戏日志</span>
			</div>
			<div className="chat-log-content">
				{logs.map((log, index) => (
					<div key={index} className={`log-entry ${getLogClass(log.type)}`}>
						<span className="log-time">{log.time}</span>
						<span className="log-message">{highlightPlayerNames(log.message)}</span>
					</div>
				))}
				<div ref={logEndRef} />
			</div>
		</div>
	);
}
