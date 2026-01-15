import { useState } from 'react';
import { TRAIT_OPTIONS, STYLE_OPTIONS, DEFAULT_PERSONALITIES } from '../utils/personalities';
import './PersonalitySettings.css';

export function PersonalitySettings({ personalities, onSave, onClose }) {
    const [editingPersonalities, setEditingPersonalities] = useState(
        personalities.map(p => ({ ...p }))
    );
    const [expandedId, setExpandedId] = useState(null);

    // 更新某个 AI 的人设
    const updatePersonality = (id, field, value) => {
        setEditingPersonalities(prev =>
            prev.map(p => (p.id === id ? { ...p, [field]: value } : p))
        );
    };

    // 重置为默认人设
    const resetToDefault = (id) => {
        const defaultPersonality = DEFAULT_PERSONALITIES.find(p => p.id === id);
        if (defaultPersonality) {
            setEditingPersonalities(prev =>
                prev.map(p => (p.id === id ? { ...defaultPersonality } : p))
            );
        }
    };

    // 重置所有人设
    const resetAll = () => {
        setEditingPersonalities(DEFAULT_PERSONALITIES.map(p => ({ ...p })));
    };

    // 保存并关闭
    const handleSave = () => {
        onSave(editingPersonalities);
        onClose();
    };

    // 切换展开/收起
    const toggleExpand = (id) => {
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <div className="personality-modal-overlay" onClick={onClose}>
            <div className="personality-modal" onClick={(e) => e.stopPropagation()}>
                <div className="personality-header">
                    <h2>🎭 AI 人设设置</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="personality-content">
                    <p className="personality-hint">
                        为每个 AI 玩家设置独特的性格和说话风格，让游戏更加有趣！
                    </p>

                    <div className="personality-list">
                        {editingPersonalities.map((personality) => (
                            <div
                                key={personality.id}
                                className={`personality-item ${expandedId === personality.id ? 'expanded' : ''}`}
                            >
                                <div
                                    className="personality-item-header"
                                    onClick={() => toggleExpand(personality.id)}
                                >
                                    <div className="personality-basic">
                                        <span className="personality-name">{personality.name}</span>
                                        <span className="personality-trait-badge">{personality.trait}</span>
                                    </div>
                                    <span className="expand-icon">{expandedId === personality.id ? '▼' : '▶'}</span>
                                </div>

                                {expandedId === personality.id && (
                                    <div className="personality-item-content">
                                        <div className="form-group">
                                            <label>性格特点</label>
                                            <select
                                                value={personality.trait}
                                                onChange={(e) => updatePersonality(personality.id, 'trait', e.target.value)}
                                            >
                                                {TRAIT_OPTIONS.map(trait => (
                                                    <option key={trait} value={trait}>{trait}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="form-group">
                                            <label>说话风格</label>
                                            <select
                                                value={personality.style}
                                                onChange={(e) => updatePersonality(personality.id, 'style', e.target.value)}
                                            >
                                                {STYLE_OPTIONS.map(style => (
                                                    <option key={style} value={style}>{style}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="form-group">
                                            <label>详细人设描述</label>
                                            <textarea
                                                value={personality.description}
                                                onChange={(e) => updatePersonality(personality.id, 'description', e.target.value)}
                                                placeholder="描述这个 AI 的性格、说话方式、行为习惯等..."
                                                rows={3}
                                            />
                                        </div>

                                        <button
                                            className="btn-reset-single"
                                            onClick={() => resetToDefault(personality.id)}
                                        >
                                            恢复默认
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="personality-footer">
                    <button className="btn-secondary" onClick={resetAll}>
                        全部重置
                    </button>
                    <div className="footer-right">
                        <button className="btn-secondary" onClick={onClose}>
                            取消
                        </button>
                        <button className="btn-primary" onClick={handleSave}>
                            保存设置
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
