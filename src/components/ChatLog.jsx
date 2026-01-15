import { useRef, useEffect } from 'react';
import './ChatLog.css';

export function ChatLog({ logs }) {
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
						<span className="log-message">{log.message}</span>
					</div>
				))}
				<div ref={logEndRef} />
			</div>
		</div>
	);
}
