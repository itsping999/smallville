import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SaveItem, SavesResponse, LlmConfig, ReverieStatus } from "../api";
import {
  deleteSave,
  fetchSaves,
  fetchLlmConfig,
  fetchReverieStatus,
  startSimulation,
  stopSimulation,
} from "../api";

export default function SavesPage() {
  const navigate = useNavigate();
  const [saves, setSaves] = useState<SavesResponse | null>(null);
  const [llm, setLlm] = useState<LlmConfig | null>(null);
  const [reverie, setReverie] = useState<ReverieStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [showLlmModal, setShowLlmModal] = useState(false);

  // New Save Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTemplateCode, setSelectedTemplateCode] = useState<string>("");
  const [newSimName, setNewSimName] = useState<string>("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const loadData = async () => {
    try {
      const [savesData, llmData, revData] = await Promise.all([
        fetchSaves(),
        fetchLlmConfig().catch(() => null),
        fetchReverieStatus().catch(() => null),
      ]);
      setSaves(savesData);
      setLlm(llmData);
      setReverie(revData);
    } catch (e: any) {
      setError(e.message || "Failed to load saves");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Smallville · World Saves";
    loadData();
  }, []);

  const handleStartLive = async (sim: SaveItem) => {
    if (!llm?.api_key_configured) {
      setShowLlmModal(true);
      return;
    }

    try {
      setBusyCode(sim.sim_code);
      await startSimulation(sim.sim_code, sim.sim_code);
      await loadData();
      setTimeout(() => {
        navigate("/live");
      }, 400);
    } catch (e: any) {
      alert(`启动实时模拟失败: ${e.message}`);
      setBusyCode(null);
    }
  };

  const handleStopLive = async () => {
    try {
      setBusyCode("stopping");
      await stopSimulation();
      await new Promise((r) => setTimeout(r, 200));
      await loadData();
    } catch (e: any) {
      alert(`停止模拟失败: ${e.message}`);
    } finally {
      setBusyCode(null);
    }
  };

  const handleDeleteSave = async (simCode: string) => {
    const confirmMsg = `确定要永久删除存档 "${simCode}" 吗？此操作无法撤销。`;
    if (!window.confirm(confirmMsg)) {
      return;
    }
    try {
      setBusyCode(`delete-${simCode}`);
      await deleteSave(simCode);
      await loadData();
    } catch (err: any) {
      alert(`删除存档失败: ${err.message}`);
    } finally {
      setBusyCode(null);
    }
  };

  const handleOpenCreateModal = () => {
    if (!llm?.api_key_configured) {
      setShowLlmModal(true);
      return;
    }
    const templateList = getTemplateList();
    if (templateList.length > 0 && !selectedTemplateCode) {
      setSelectedTemplateCode(templateList[0].sim_code);
    }
    setNewSimName(`town-${Date.now().toString().slice(-4)}`);
    setCreateError(null);
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newSimName.trim();
    if (!cleanName) {
      setCreateError("请输入存档名称");
      return;
    }
    if (!/^[A-Za-z0-9_.-]+$/.test(cleanName)) {
      setCreateError("名称仅允许英文、数字、下划线(_)和短横线(-)");
      return;
    }
    if (!selectedTemplateCode) {
      setCreateError("请选择一个世界模板");
      return;
    }

    try {
      setIsCreating(true);
      setCreateError(null);
      await startSimulation(selectedTemplateCode, cleanName);
      setTimeout(() => {
        navigate("/live");
      }, 600);
    } catch (err: any) {
      setCreateError(err.message || "创建存档并启动失败");
      setIsCreating(false);
    }
  };

  const getTemplateList = (): SaveItem[] => {
    if (!saves) return [];
    if (saves.templates && saves.templates.length > 0) {
      return saves.templates;
    }
    return saves.simulations.filter((s) => s.is_base);
  };

  const getDisplaySaves = (): SaveItem[] => {
    if (!saves) return [];
    if (saves.saves && saves.saves.length > 0) {
      return saves.saves;
    }
    return [...saves.demos, ...saves.simulations.filter((s) => !s.is_base)];
  };

  if (loading) {
    return (
      <div className="page saves-page">
        <div className="loading">正在加载存档与小镇世界...</div>
      </div>
    );
  }

  if (error || !saves) {
    return (
      <div className="page saves-page">
        <div className="error-page">
          <h2>加载存档失败</h2>
          <p>{error || "无法获取存档列表"}</p>
          <button type="button" className="btn-primary" onClick={loadData}>
            重试
          </button>
        </div>
      </div>
    );
  }

  const isLiveRunning = Boolean(reverie?.running);
  const displaySaves = getDisplaySaves();
  const templateList = getTemplateList();

  return (
    <div className="page saves-page">
      <header className="saves-header">
        <div className="saves-title-group">
          <div className="header-badge-row">
            <span className="mode-pill live">Smallville Console</span>
            {llm?.api_key_configured ? (
              <span className="llm-status-pill ready" title={`Base URL: ${llm.base_url}`}>
                ● 大模型已就绪 ({llm.model || "自定义模型"})
              </span>
            ) : (
              <span className="llm-status-pill warning" onClick={() => setShowLlmModal(true)}>
                ⚠️ 未配置大模型（离线回放可用，实时计算需配置 .env）
              </span>
            )}
          </div>
          <h1>小镇世界与存档管理</h1>
          <p className="saves-subtitle">
            查看与管理所有小镇存档。每个存档均可进行<strong>动作轨迹回放</strong>或启动大模型<strong>实时认知推演</strong>。
          </p>
        </div>

        <div className="saves-header-actions">
          <button
            type="button"
            className="btn-primary new-save-btn"
            onClick={handleOpenCreateModal}
          >
            ➕ 新建存档
          </button>
        </div>
      </header>

      {isLiveRunning && (
        <section className="active-sim-banner" aria-label="正在运行的实时模拟">
          <div className="active-sim-info">
            <span className="live-pulse" />
            <div>
              <strong>后台正在运行实时模拟: {reverie?.sim_code}</strong>
              <p>
                当前步数: Step {reverie?.step ?? 1} • 小镇时间: {reverie?.curr_time || "推进中..."}
              </p>
            </div>
          </div>
          <div className="active-sim-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate("/live")}
            >
              👁️ 进入实时观察台
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleStopLive}
              disabled={busyCode === "stopping"}
            >
              {busyCode === "stopping" ? "停止中..." : "⏹️ 停止模拟"}
            </button>
          </div>
        </section>
      )}

      <main className="saves-content">
        <section className="saves-section">
          <div className="section-title-wrap">
            <div className="section-title-row">
              <div>
                <span className="section-kicker">Town Archives</span>
                <h2>📁 存档列表</h2>
                <p>包含预置实验演示与实时推演存档，点击对应按钮即可回放轨迹或启动实时推演。</p>
              </div>
              <span className="saves-count-badge">共 {displaySaves.length} 个存档</span>
            </div>
          </div>

          {displaySaves.length === 0 ? (
            <div className="empty-saves-box">
              <p>暂无本地运行存档。您可以点击上方按钮使用基础世界模板新建存档！</p>
              <button
                type="button"
                className="btn-primary"
                onClick={handleOpenCreateModal}
              >
                ➕ 立即新建存档
              </button>
            </div>
          ) : (
            <div className="saves-grid">
              {displaySaves.map((item) => {
                const isStarting = busyCode === item.sim_code;
                const isCurrentLive = isLiveRunning && reverie?.sim_code === item.sim_code;

                return (
                  <article
                    key={item.sim_code}
                    className={`save-card ${isCurrentLive ? "active-live-card" : ""}`}
                  >
                    <div className="save-card-header">
                      <div>
                        {isCurrentLive && (
                          <span className="save-type-badge live active-live-badge">
                            🟢 正在运行
                          </span>
                        )}
                        <h3>{item.title.replace(/\s*Demo\b/gi, "")}</h3>
                        <span className="save-code">{item.sim_code}</span>
                      </div>
                      {!isCurrentLive && (
                        <button
                          type="button"
                          className="btn-delete-card"
                          title={`删除存档 ${item.sim_code}`}
                          onClick={() => handleDeleteSave(item.sim_code)}
                          disabled={busyCode !== null}
                        >
                          {busyCode === `delete-${item.sim_code}` ? "..." : "🗑️"}
                        </button>
                      )}
                    </div>

                    <div className="save-meta-row">
                      <div>
                        <dt>进度步数</dt>
                        <dd>{item.step ? `${item.step} 步` : "初始状态"}</dd>
                      </div>
                      <div>
                        <dt>居民人数</dt>
                        <dd>{item.persona_names.length} 人</dd>
                      </div>
                      <div>
                        <dt>单步耗时</dt>
                        <dd>{item.sec_per_step ? `${item.sec_per_step}s` : "10s"}</dd>
                      </div>
                    </div>

                    <div className="save-roster">
                      <span className="roster-label">参演居民:</span>
                      <div className="roster-avatars">
                        {item.persona_names.slice(0, 10).map((p) => (
                          <div key={p.underscore} className="avatar-chip" title={p.original}>
                            <img
                              src={`/static/assets/characters/profile/${p.underscore}.png`}
                              alt={p.original}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "/static/img/atlas.png";
                              }}
                            />
                            <span>{p.original}</span>
                          </div>
                        ))}
                        {item.persona_names.length > 10 && (
                          <span className="roster-more">
                            +{item.persona_names.length - 10} 人
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="save-actions">
                      {item.can_replay && (
                        <button
                          type="button"
                          className="btn-secondary play-btn"
                          onClick={() =>
                            navigate(
                              `/demo/${item.sim_code}/${item.default_step || item.step || 1}`
                            )
                          }
                          title="回放此存档已录制的动作与对话轨迹"
                        >
                          🎬 动作回放
                        </button>
                      )}
                      {item.can_live &&
                        (isCurrentLive ? (
                          <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                            <button
                              type="button"
                              className="btn-primary live-btn"
                              style={{ flex: 1 }}
                              onClick={() => navigate("/live")}
                            >
                              👁️ 实时观察中
                            </button>
                            <button
                              type="button"
                              className="btn-secondary live-btn"
                              onClick={handleStopLive}
                              disabled={busyCode === "stopping"}
                              title="停止实时推演"
                            >
                              {busyCode === "stopping" ? "停止中..." : "⏹️ 停止"}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn-accent live-btn"
                            onClick={() => handleStartLive(item)}
                            disabled={isLiveRunning || isStarting}
                            title="启动后台大模型引擎对此存档继续推演"
                          >
                            {isStarting ? "正在拉起引擎..." : "⚡️ 实时模拟"}
                          </button>
                        ))}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* 新建存档模版弹窗 */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => !isCreating && setShowCreateModal(false)}>
          <div className="modal-content create-modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => !isCreating && setShowCreateModal(false)}
              disabled={isCreating}
            >
              &times;
            </button>
            <h2>新建小镇存档</h2>
            <p className="modal-subtitle">
              选择一个基础世界模板并指定新存档名称，系统将为您初始化世界并拉起大模型实时模拟。
            </p>

            <form onSubmit={handleCreateSubmit}>
              <span className="template-selection-title">1. 选择世界模板</span>
              <div className="template-grid">
                {templateList.map((tpl) => {
                  const isSelected = selectedTemplateCode === tpl.sim_code;
                  const isExpanded = tpl.sim_code.includes("expanded");
                  const isN25 = tpl.sim_code.includes("n25");

                  return (
                    <div
                      key={tpl.sim_code}
                      className={`template-card ${isSelected ? "selected" : ""}`}
                      onClick={() => setSelectedTemplateCode(tpl.sim_code)}
                    >
                      <span className="template-card-icon">
                        {isExpanded ? "🏙️" : isN25 ? "👥" : "🏡"}
                      </span>
                      <div className="template-card-info">
                        <strong>{tpl.title}</strong>
                        <p>
                          {isExpanded
                            ? "扩展版地图：3 位居民，新增社区诊所、中心图书馆、街机娱乐厅与湖畔公园"
                            : isN25
                            ? "完整斯坦福小镇：25 位全阵容居民，支持丰富的大规模多智能体社会交互"
                            : "经典基础小镇：3 位核心居民（Isabella, Maria, Klaus），轻量快速"}
                        </p>
                        <span className="template-tag">
                          {tpl.persona_names.length} 位居民 • 模板代码: {tpl.sim_code}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="sim-name-input">
                  2. 输入新存档名称 (标识符)
                </label>
                <input
                  id="sim-name-input"
                  type="text"
                  className="form-input"
                  value={newSimName}
                  onChange={(e) => setNewSimName(e.target.value)}
                  placeholder="例如: my_smallville_town"
                  disabled={isCreating}
                  required
                />
                <p className="form-hint">
                  该名称将作为本地文件夹与存档标识，仅允许英文字母、数字、下划线与短横线。
                </p>
              </div>

              {createError && <p className="error-detail modal-error">{createError}</p>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isCreating}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isCreating || !newSimName.trim()}
                >
                  {isCreating ? "正在创建并拉起引擎..." : "🚀 创建并启动模拟"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LLM 未配置引导弹窗框 */}
      {showLlmModal && (
        <div className="modal-overlay" onClick={() => setShowLlmModal(false)}>
          <div className="modal-content llm-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowLlmModal(false)}>
              &times;
            </button>
            <h2>需要配置大语言模型 (LLM)</h2>
            <p>
              【实时计算】需要大模型为智能体提供实时思维与行动决策。当前系统未检测到有效的{" "}
              <code>LLM_API_KEY</code>。
            </p>

            <div className="instruction-box">
              <h3>如何开启实时计算？</h3>
              <ol>
                <li>
                  在项目根目录的 <code>.env</code> 文件中配置您的大模型 API 地址与密钥：
                </li>
                <pre className="code-block">
                  LLM_BASE_URL=https://your-api-provider.com/v1{"\n"}
                  LLM_API_KEY=sk-your-actual-api-key{"\n"}
                  LLM_MODEL=gpt-4o-mini
                </pre>
                <li>
                  执行配置同步脚本：
                  <code>python3 scripts/generate_utils.py</code>
                </li>
                <li>刷新本页面，大模型状态变为就绪即可开启实时认知计算！</li>
              </ol>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowLlmModal(false)}
              >
                我知道了，稍后配置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
