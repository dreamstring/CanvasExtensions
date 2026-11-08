# Multiple installations and experimental compatibility (0.6.0)

Discovery sources: running Figma executable path; HKCU/HKLM, 32/64-bit App Paths; Figma uninstall records (InstallLocation/DisplayIcon); LocalAppData/Figma and Program Files/Figma app-* folders. Discovery reads metadata only. Candidate paths can be selected explicitly, or a full Figma.exe/app.asar/app-version directory entered. The choice persists. The selected target is pinned for the manager session and reviewed plans bind the exact path and bytes.

This fixes missing-path failures on machines without app-126.10.7. It does not claim all releases are compatible.

Verified resource profile remains the known original SHA256 for 126.10.7. Matching original bytes can be used from another installation directory. Other original archives require the non-persistent Experimental compatibility switch (enabled by default since 0.6.4). Preconditions: known base36 length trailer; parseable packed bounds; package identifies Figma and main.js entry; main.js/package.json SHA256 member integrity; dry-run archive append accepts the member layout without an existing loader marker. A modified or conflicting registered installation is never silently treated as a fresh baseline.

These are static prerequisites, not proof of startup, Electron fuse policy, native integrity checks, editor API compatibility or sidebar geometry. New client versions still need startup and real GIF/export acceptance. Do not advertise experimental versions as verified profiles.

Records/backups for new installations are under `installations/<canonical-target-key>/`; the existing matching legacy record is reused so original restore remains available. Separate app-version paths get separate recovery identities. Existing original backups cannot be overwritten with another digest. Restoring an experimental installation does not require the experimental switch; current target and backup bytes must match its recorded state. Review/commit refuse running Figma and stale plans.

UI flow for another machine:
1. Start 0.6.0; open Installation and diagnostics.
2. Rescan and select the actual installation, or enter its executable path.
3. Check compatibility (read-only). A path that cannot be found is a location issue; a failed structural check is an adapter issue.
4. If structurally eligible but unverified, save and exit Figma, explicitly choose experimental compatibility, check the update plan and apply.
5. Reopen Figma; verify normal startup and extensions. If startup fails, close residual Figma processes via the manager's confirmed close action and restore the selected installation.
6. Copy diagnostics including target, version, hashes and structural result for evidence-based profile promotion.

Tests: original installation unchanged; existing verified install/update/restore tests; synthetic second-version fixture (not a real release and never executed) for disabled-mode rejection, default-enabled experimental plan, footer preservation and byte-exact restore; distinct canonical installation identities. Actual registry discovery was tested on this machine only; no other person's computer was accessed.
# 仓库兼容清单

`runtime/compatibility.json` 随每次构建发布。注入成功后登记版本号、**原版 app.asar SHA-256**、验证范围与证据。安装器按原版哈希匹配，而不是只比较版本号；同版本资源不同仍走实验兼容。

`injection` 只表示安装写入已成功；`startup-and-extensions` 表示还通过启动和扩展验收。Box 等模块的功能验收独立记录。126.11.8 已登记注入、启动和 Box 0.1.6 用户验收；其他模块与工作流的覆盖范围不能据此扩大。不得将仅通过结构检查的版本登记为成功。
