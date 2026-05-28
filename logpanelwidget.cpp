#include "logpanelwidget.h"

#include <QComboBox>
#include <QDesktopServices>
#include <QFont>
#include <QHBoxLayout>
#include <QLabel>
#include <QPlainTextEdit>
#include <QPushButton>
#include <QTextCursor>
#include <QUrl>
#include <QVBoxLayout>

LogPanelWidget::LogPanelWidget(QWidget *parent)
    : QWidget(parent)
{
    auto *root = new QVBoxLayout(this);
    root->setContentsMargins(0, 8, 0, 0);

    auto *hint = new QLabel(
        QStringLiteral("运行日志会写入本地文件，便于排查网络与接口问题。"), this);
    hint->setWordWrap(true);
    hint->setStyleSheet(QStringLiteral("color: #666;"));
    root->addWidget(hint);

    auto *tool = new QHBoxLayout;
    tool->addWidget(new QLabel(QStringLiteral("最低级别："), this));
    m_levelFilter = new QComboBox(this);
    m_levelFilter->addItem(QStringLiteral("全部 (Debug)"), static_cast<int>(AppLogger::Level::Debug));
    m_levelFilter->addItem(QStringLiteral("Info 及以上"), static_cast<int>(AppLogger::Level::Info));
    m_levelFilter->addItem(QStringLiteral("Warn 及以上"), static_cast<int>(AppLogger::Level::Warn));
    m_levelFilter->addItem(QStringLiteral("仅 Error"), static_cast<int>(AppLogger::Level::Error));
    tool->addWidget(m_levelFilter);
    tool->addStretch();
    m_clearBtn = new QPushButton(QStringLiteral("清空显示"), this);
    m_openFolderBtn = new QPushButton(QStringLiteral("打开日志目录"), this);
    tool->addWidget(m_clearBtn);
    tool->addWidget(m_openFolderBtn);
    root->addLayout(tool);

    m_view = new QPlainTextEdit(this);
    m_view->setReadOnly(true);
    m_view->setLineWrapMode(QPlainTextEdit::NoWrap);
    QFont mono = m_view->font();
    mono.setStyleHint(QFont::Monospace);
    m_view->setFont(mono);
    root->addWidget(m_view, 1);

    const auto &logger = AppLogger::instance();
    for (const QString &line : logger.recentLines())
        appendLine(line, AppLogger::Level::Info);

    connect(&AppLogger::instance(), &AppLogger::logRecorded, this, &LogPanelWidget::onLogRecorded);
    connect(m_clearBtn, &QPushButton::clicked, this, &LogPanelWidget::onClearClicked);
    connect(m_openFolderBtn, &QPushButton::clicked, this, &LogPanelWidget::onOpenFolderClicked);
    connect(m_levelFilter, QOverload<int>::of(&QComboBox::currentIndexChanged), this,
            &LogPanelWidget::onLevelFilterChanged);

    AppLogger::instance().info(QStringLiteral("LogUI"), QStringLiteral("日志页已就绪"));
}

bool LogPanelWidget::passFilter(AppLogger::Level level) const
{
    return static_cast<int>(level) >= static_cast<int>(m_filterMin);
}

void LogPanelWidget::appendLine(const QString &line, AppLogger::Level level)
{
    if (!passFilter(level))
        return;

    m_view->appendPlainText(line);
    auto cursor = m_view->textCursor();
    cursor.movePosition(QTextCursor::End);
    m_view->setTextCursor(cursor);
}

void LogPanelWidget::onLogRecorded(const QString &line, AppLogger::Level level)
{
    appendLine(line, level);
}

void LogPanelWidget::onClearClicked()
{
    m_view->clear();
    AppLogger::instance().info(QStringLiteral("LogUI"), QStringLiteral("已清空界面显示（文件日志保留）"));
}

void LogPanelWidget::onOpenFolderClicked()
{
    const QString dir = AppLogger::instance().logDirectory();
    QDesktopServices::openUrl(QUrl::fromLocalFile(dir));
}

void LogPanelWidget::onLevelFilterChanged(int index)
{
    Q_UNUSED(index);
    m_filterMin = static_cast<AppLogger::Level>(m_levelFilter->currentData().toInt());

    m_view->clear();
    const auto &logger = AppLogger::instance();
    for (const QString &line : logger.recentLines()) {
        AppLogger::Level level = AppLogger::Level::Info;
        if (line.contains(QStringLiteral("[DEBUG]")))
            level = AppLogger::Level::Debug;
        else if (line.contains(QStringLiteral("[WARN]")))
            level = AppLogger::Level::Warn;
        else if (line.contains(QStringLiteral("[ERROR]")))
            level = AppLogger::Level::Error;
        appendLine(line, level);
    }
}
