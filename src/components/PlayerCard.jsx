import './PlayerCard.css';

export function PlayerCard({ player, isCurrentSpeaker, onSelect, selectable, showRole, onViewHistory }) {
	const statusClass = player.isAlive ? 'alive' : 'dead';
	const speakerClass = isCurrentSpeaker ? 'speaking' : '';
	const selectableClass = selectable ? 'selectable' : '';

	const handleClick = () => {
		if (selectable && onSelect) {
			onSelect(player.id);
		} else if (onViewHistory) {
			onViewHistory(player);
		}
	};

	return (
		<div
			className={`player-card ${statusClass} ${speakerClass} ${selectableClass} ${onViewHistory ? 'clickable' : ''}`}
			onClick={handleClick}
		>
			<div className="player-avatar">
				{player.isAlive ? (
					showRole || player.isHuman ? player.role.emoji : '❓'
				) : '💀'}
			</div>
			<div className="player-name">{player.name}</div>
			{player.isHuman && <div className="player-tag">你</div>}
			{!player.isAlive && showRole && <div className="player-role-reveal">{player.role.name}</div>}
			{showRole && player.isAlive && <div className="player-role-name">{player.role.name}</div>}
			{isCurrentSpeaker && <div className="speaking-indicator">发言中...</div>}
			{onViewHistory && <div className="view-history-hint">点击查看发言</div>}
		</div>
	);
}
