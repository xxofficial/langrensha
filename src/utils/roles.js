// 狼人杀角色定义
export const ROLES = {
	WEREWOLF: {
		id: 'werewolf',
		name: '狼人',
		team: 'wolf',
		emoji: '🐺',
		description: '夜晚可以杀死一名玩家'
	},
	SEER: {
		id: 'seer',
		name: '预言家',
		team: 'good',
		emoji: '🔮',
		description: '夜晚可以查验一名玩家的身份'
	},
	WITCH: {
		id: 'witch',
		name: '女巫',
		team: 'good',
		emoji: '🧙‍♀️',
		description: '拥有一瓶解药和一瓶毒药'
	},
	HUNTER: {
		id: 'hunter',
		name: '猎人',
		team: 'good',
		emoji: '🏹',
		description: '死亡时可以开枪带走一名玩家'
	},
	VILLAGER: {
		id: 'villager',
		name: '村民',
		team: 'good',
		emoji: '👤',
		description: '普通村民，没有特殊技能'
	}
};

// 8人局角色配置: 2狼人 + 1预言家 + 1女巫 + 1猎人 + 3村民
export const ROLE_CONFIG = [
	ROLES.WEREWOLF,
	ROLES.WEREWOLF,
	ROLES.SEER,
	ROLES.WITCH,
	ROLES.HUNTER,
	ROLES.VILLAGER,
	ROLES.VILLAGER,
	ROLES.VILLAGER
];

// 洗牌算法 (Fisher-Yates)
function shuffle(array) {
	const result = [...array];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

// 随机分配角色
export function assignRoles(playerCount = 8) {
	const shuffledRoles = shuffle(ROLE_CONFIG);
	return shuffledRoles.slice(0, playerCount);
}

// 玩家颜色列表（8个不同的颜色）
const PLAYER_COLORS = [
	'#f472b6', // 粉色
	'#60a5fa', // 蓝色
	'#4ade80', // 绿色
	'#fbbf24', // 黄色
	'#a78bfa', // 紫色
	'#f97316', // 橙色
	'#22d3d8', // 青色
	'#fb7185', // 玫红色
];

// 创建玩家列表
export function createPlayers(humanPlayerIndex = 0, personalities = null, playerName = '玩家') {
	const roles = assignRoles(8);
	const aiNames = ['小明', '小红', '小刚', '小丽', '小华', '小龙', '小凤'];
	const shuffledAINames = shuffle(aiNames);
	const shuffledColors = shuffle(PLAYER_COLORS);

	// 随机决定人类玩家的位置（0-7）
	const humanPosition = Math.floor(Math.random() * 8);

	// 创建所有玩家
	const players = [];
	let aiNameIndex = 0;

	for (let i = 0; i < 8; i++) {
		const isHuman = i === humanPosition;
		const role = roles[i];

		// 获取对应的人设（仅AI玩家）
		let personality = null;
		if (!isHuman && personalities) {
			personality = personalities.find(p => p.id === i) || null;
		}

		players.push({
			id: i,
			name: isHuman ? playerName : shuffledAINames[aiNameIndex++],
			role: role,
			isAlive: true,
			isHuman: isHuman,
			// 玩家颜色
			color: shuffledColors[i],
			// 女巫的药水状态
			witchPotion: role.id === 'witch' ? { heal: true, poison: true } : null,
			// 预言家的查验记录
			seerResults: role.id === 'seer' ? [] : null,
			// AI 人设
			personality: personality
		});
	}

	return players;
}

// 获取存活玩家
export function getAlivePlayers(players) {
	return players.filter(p => p.isAlive);
}

// 获取存活狼人
export function getAliveWerewolves(players) {
	return getAlivePlayers(players).filter(p => p.role.id === 'werewolf');
}

// 获取存活好人
export function getAliveGoodPlayers(players) {
	return getAlivePlayers(players).filter(p => p.role.team === 'good');
}

// 判断游戏是否结束
export function checkGameOver(players) {
	const aliveWolves = getAliveWerewolves(players);
	const aliveGood = getAliveGoodPlayers(players);

	if (aliveWolves.length === 0) {
		return { gameOver: true, winner: 'good', message: '🎉 好人阵营胜利！所有狼人已被消灭！' };
	}

	if (aliveGood.length <= aliveWolves.length) {
		return { gameOver: true, winner: 'wolf', message: '🐺 狼人阵营胜利！' };
	}

	return { gameOver: false, winner: null, message: null };
}
