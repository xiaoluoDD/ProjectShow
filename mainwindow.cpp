#include "mainwindow.h"

#include "applogger.h"
#include "debugpanelwidget.h"
#include "logpanelwidget.h"
#include "projectpanelwidget.h"

#include <QHBoxLayout>
#include <QLabel>
#include <QLineEdit>
#include <QNetworkAccessManager>
#include <QSettings>
#include <QTabWidget>
#include <QVBoxLayout>
#include <QWidget>

namespace {

QString trimTrailingSlash(QString url)
{
    while (url.endsWith(QLatin1Char('/')))
        url.chop(1);
    return url;
}

} // namespace

MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)
    , m_net(new QNetworkAccessManager(this))
{
    setWindowTitle(QStringLiteral("项目看板"));
    resize(960, 640);

    auto *central = new QWidget(this);
    auto *root = new QVBoxLayout(central);
    root->setContentsMargins(8, 8, 8, 8);

    auto *serverRow = new QHBoxLayout;
    serverRow->addWidget(new QLabel(QStringLiteral("后端地址："), this));
    m_serverEdit = new QLineEdit(this);
    m_serverEdit->setPlaceholderText(QStringLiteral("例如 http://106.53.181.55:8081"));
    QSettings settings;
    QString saved = settings.value(QStringLiteral("serverBaseUrl"),
                                   QStringLiteral("http://106.53.181.55:8081"))
                        .toString();
    if (saved.endsWith(QStringLiteral(":8080")))
        saved.replace(QStringLiteral(":8080"), QStringLiteral(":8081"));
    m_serverEdit->setText(saved);
    serverRow->addWidget(m_serverEdit, 1);
    root->addLayout(serverRow);

    m_tabs = new QTabWidget(this);
    m_projectPanel = new ProjectPanelWidget(this);
    m_debugPanel = new DebugPanelWidget(this);
    m_logPanel = new LogPanelWidget(this);
    m_tabs->addTab(m_projectPanel, QStringLiteral("项目面板"));
    m_tabs->addTab(m_debugPanel, QStringLiteral("调试"));
    m_tabs->addTab(m_logPanel, QStringLiteral("日志"));
    root->addWidget(m_tabs, 1);

    setCentralWidget(central);

    connect(m_serverEdit, &QLineEdit::editingFinished, this, &MainWindow::saveServerUrl);

    AppLogger::instance().info(QStringLiteral("App"),
                               QStringLiteral("主窗口已启动，后端：%1").arg(serverBaseUrl()));
}

MainWindow::~MainWindow() = default;

QString MainWindow::serverBaseUrl() const
{
    return trimTrailingSlash(m_serverEdit->text().trimmed());
}

QNetworkAccessManager *MainWindow::networkManager() const
{
    return m_net;
}

void MainWindow::saveServerUrl() const
{
    const QString url = serverBaseUrl();
    QSettings settings;
    settings.setValue(QStringLiteral("serverBaseUrl"), url);
    AppLogger::instance().info(QStringLiteral("App"), QStringLiteral("后端地址已保存：%1").arg(url));
}
