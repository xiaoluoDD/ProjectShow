#include "mainwindow.h"

#include "applogger.h"
#include "debughubwidget.h"
#include "memberpanelwidget.h"
#include "projectpanelwidget.h"

#include <QFrame>
#include <QHBoxLayout>
#include <QLabel>
#include <QLineEdit>
#include <QNetworkAccessManager>
#include <QSettings>
#include <QTabWidget>
#include <QVBoxLayout>
#include <QWidget>

namespace {

QString trimTrailingSlash(QString baseUrl)
{
    while (baseUrl.endsWith(QLatin1Char('/')))
        baseUrl.chop(1);
    return baseUrl;
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

    auto *serverBar = new QFrame(this);
    serverBar->setObjectName(QStringLiteral("serverBar"));
    auto *serverRow = new QHBoxLayout(serverBar);
    serverRow->setContentsMargins(8, 6, 8, 6);
    auto *serverLabel = new QLabel(QStringLiteral("后端地址"), serverBar);
    serverLabel->setObjectName(QStringLiteral("serverBarLabel"));
    serverRow->addWidget(serverLabel);
    m_serverEdit = new QLineEdit(serverBar);
    m_serverEdit->setObjectName(QStringLiteral("serverUrlEdit"));
    m_serverEdit->setPlaceholderText(QStringLiteral("例如 http://106.53.181.55:8081"));
    QSettings settings;
    QString saved = settings.value(QStringLiteral("serverBaseUrl"),
                                   QStringLiteral("http://106.53.181.55:8081"))
                        .toString();
    if (saved.endsWith(QStringLiteral(":8080")))
        saved.replace(QStringLiteral(":8080"), QStringLiteral(":8081"));
    m_serverEdit->setText(saved);
    serverRow->addWidget(m_serverEdit, 1);
    root->addWidget(serverBar);

    m_tabs = new QTabWidget(this);
    m_tabs->setObjectName(QStringLiteral("mainTabWidget"));
    m_projectPanel = new ProjectPanelWidget(this);
    m_memberPanel = new MemberPanelWidget(this);
    m_debugHub = new DebugHubWidget(this);
    m_tabs->addTab(m_projectPanel, QStringLiteral("项目面板"));
    m_tabs->addTab(m_memberPanel, QStringLiteral("项目成员"));
    m_tabs->addTab(m_debugHub, QStringLiteral("调试"));
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

QString MainWindow::selectedMemberUserId() const
{
    return m_selectedUserId;
}

QString MainWindow::selectedMemberName() const
{
    return m_selectedMemberName;
}

QString MainWindow::selectedMemberDisplay() const
{
    if (m_selectedUserId.isEmpty())
        return QStringLiteral("（未选择）");
    if (!m_selectedMemberName.isEmpty())
        return QStringLiteral("%1（%2）").arg(m_selectedMemberName, m_selectedUserId);
    return m_selectedUserId;
}

void MainWindow::setSelectedMember(const QString &userid, const QString &name)
{
    if (m_selectedUserId == userid && m_selectedMemberName == name)
        return;

    m_selectedUserId = userid;
    m_selectedMemberName = name;
    emit memberSelectionChanged(userid, name);

    if (userid.isEmpty()) {
        AppLogger::instance().info(QStringLiteral("Member"), QStringLiteral("已取消成员选择"));
    } else {
        AppLogger::instance().info(
            QStringLiteral("Member"),
            QStringLiteral("已选择成员：%1").arg(selectedMemberDisplay()));
    }
}

void MainWindow::saveServerUrl() const
{
    const QString baseUrl = serverBaseUrl();
    QSettings settings;
    settings.setValue(QStringLiteral("serverBaseUrl"), baseUrl);
    AppLogger::instance().info(QStringLiteral("App"), QStringLiteral("后端地址已保存：%1").arg(baseUrl));
}
