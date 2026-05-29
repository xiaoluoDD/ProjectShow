#include "debughubwidget.h"

#include "datapanelwidget.h"
#include "debugpanelwidget.h"
#include "logpanelwidget.h"

#include <QTabWidget>
#include <QVBoxLayout>

DebugHubWidget::DebugHubWidget(QWidget *parent)
    : QWidget(parent)
{
    auto *root = new QVBoxLayout(this);
    root->setContentsMargins(0, 0, 0, 0);

    m_subTabs = new QTabWidget(this);
    m_subTabs->setObjectName(QStringLiteral("debugSubTabs"));
    m_subTabs->setDocumentMode(true);

    m_debugPanel = new DebugPanelWidget(this);
    m_dataPanel = new DataPanelWidget(this);
    m_logPanel = new LogPanelWidget(this);

    m_subTabs->addTab(m_debugPanel, QStringLiteral("接口调试"));
    m_subTabs->addTab(m_dataPanel, QStringLiteral("本地数据"));
    m_subTabs->addTab(m_logPanel, QStringLiteral("日志"));

    root->addWidget(m_subTabs);
}

DebugPanelWidget *DebugHubWidget::debugPanel() const
{
    return m_debugPanel;
}

DataPanelWidget *DebugHubWidget::dataPanel() const
{
    return m_dataPanel;
}

LogPanelWidget *DebugHubWidget::logPanel() const
{
    return m_logPanel;
}
