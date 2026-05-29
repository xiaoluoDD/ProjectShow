#ifndef DEBUGHUBWIDGET_H
#define DEBUGHUBWIDGET_H

#include <QWidget>

class QTabWidget;
class DebugPanelWidget;
class DataPanelWidget;
class LogPanelWidget;

/// 调试中心：二级标签（接口调试 / 本地数据 / 日志）
class DebugHubWidget : public QWidget
{
public:
    explicit DebugHubWidget(QWidget *parent = nullptr);

    DebugPanelWidget *debugPanel() const;
    DataPanelWidget *dataPanel() const;
    LogPanelWidget *logPanel() const;

private:
    QTabWidget *m_subTabs = nullptr;
    DebugPanelWidget *m_debugPanel = nullptr;
    DataPanelWidget *m_dataPanel = nullptr;
    LogPanelWidget *m_logPanel = nullptr;
};

#endif // DEBUGHUBWIDGET_H
