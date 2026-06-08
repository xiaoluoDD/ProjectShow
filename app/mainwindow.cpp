#include "mainwindow.h"

#include "applogger.h"
#include "debughubwidget.h"
#include "departmentpanelwidget.h"
#include "memberpanelwidget.h"
#include "projectpanelwidget.h"

#include <QJsonDocument>
#include <QJsonObject>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QSettings>
#include <QTabWidget>
#include <QTimer>
#include <QUrl>
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

    QSettings settings;
    QString saved = settings.value(QStringLiteral("serverBaseUrl"),
                                   QStringLiteral("http://106.53.181.55:8081"))
                        .toString();
    if (saved.endsWith(QStringLiteral(":8080")))
        saved.replace(QStringLiteral(":8080"), QStringLiteral(":8081"));
    m_serverBaseUrl = trimTrailingSlash(saved.trimmed());

    auto *central = new QWidget(this);
    auto *root = new QVBoxLayout(central);
    root->setContentsMargins(8, 8, 8, 8);

    m_tabs = new QTabWidget(this);
    m_tabs->setObjectName(QStringLiteral("mainTabWidget"));
    m_projectPanel = new ProjectPanelWidget(this);
    m_memberPanel = new MemberPanelWidget(this);
    m_departmentPanel = new DepartmentPanelWidget(this);
    m_debugHub = new DebugHubWidget(this);
    m_tabs->addTab(m_projectPanel, QStringLiteral("项目面板"));
    m_tabs->addTab(m_memberPanel, QStringLiteral("项目成员"));
    m_tabs->addTab(m_departmentPanel, QStringLiteral("部门管理"));
    m_tabs->addTab(m_debugHub, QStringLiteral("调试"));
    root->addWidget(m_tabs, 1);

    setCentralWidget(central);

    AppLogger::instance().info(QStringLiteral("App"),
                               QStringLiteral("主窗口已启动，后端：%1").arg(serverBaseUrl()));

    QTimer::singleShot(0, this, &MainWindow::loadServerUrlFromBackend);
}

MainWindow::~MainWindow() = default;

QString MainWindow::serverBaseUrl() const
{
    return m_serverBaseUrl;
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

void MainWindow::setServerBaseUrl(const QString &url)
{
    const QString normalized = trimTrailingSlash(url.trimmed());
    if (normalized.isEmpty() || m_serverBaseUrl == normalized)
        return;

    m_serverBaseUrl = normalized;
    QSettings settings;
    settings.setValue(QStringLiteral("serverBaseUrl"), normalized);
    emit serverBaseUrlChanged(normalized);
    AppLogger::instance().info(QStringLiteral("App"), QStringLiteral("后端地址已更新：%1").arg(normalized));
}

void MainWindow::loadServerUrlFromBackend()
{
    if (m_serverBaseUrl.isEmpty())
        return;

    QNetworkRequest netRequest(QUrl(m_serverBaseUrl + QStringLiteral("/api/settings")));
    QNetworkReply *reply = m_net->get(netRequest);
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        if (reply->error() != QNetworkReply::NoError)
            return;

        const QJsonDocument doc = QJsonDocument::fromJson(reply->readAll());
        if (!doc.isObject())
            return;

        const QJsonObject obj = doc.object();
        if (!obj.value(QStringLiteral("ok")).toBool(false))
            return;

        const QString url =
            obj.value(QStringLiteral("settings")).toObject().value(QStringLiteral("server_base_url")).toString();
        if (!url.isEmpty())
            setServerBaseUrl(url);
    });
}
