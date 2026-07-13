#include "mainwindow.h"

#include "applogger.h"
#include "appversion.h"
#include "debugaccess.h"
#include "debughubwidget.h"
#include "dashboardpanelwidget.h"
#include "departmentpanelwidget.h"
#include "memberpanelwidget.h"
#include "projectpanelwidget.h"

#include <QInputDialog>
#include <QJsonDocument>
#include <QJsonObject>
#include <QLineEdit>
#include <QMouseEvent>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QSettings>
#include <QTabBar>
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

class MainTabBar : public QTabBar
{
public:
    explicit MainTabBar(MainWindow *window, QWidget *parent = nullptr)
        : QTabBar(parent)
        , m_window(window)
    {
    }

protected:
    void mousePressEvent(QMouseEvent *event) override
    {
        const int idx = tabAt(event->pos());
        if (idx >= 0 && m_window && !m_window->allowTabBarSwitch(idx))
            return;
        QTabBar::mousePressEvent(event);
    }

private:
    MainWindow *m_window = nullptr;
};

class MainTabWidget : public QTabWidget
{
public:
    explicit MainTabWidget(MainWindow *window, QWidget *parent = nullptr)
        : QTabWidget(parent)
    {
        setTabBar(new MainTabBar(window, this));
    }
};

MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)
    , m_net(new QNetworkAccessManager(this))
{
    setWindowTitle(AppVersion::windowTitle());
    resize(1180, 760);

    QSettings settings;
    QString saved = settings.value(QStringLiteral("serverBaseUrl"),
                                   QStringLiteral("http://8.134.255.174:8081"))
                        .toString();
    if (saved.endsWith(QStringLiteral(":8080")))
        saved.replace(QStringLiteral(":8080"), QStringLiteral(":8081"));
    m_serverBaseUrl = trimTrailingSlash(saved.trimmed());

    auto *central = new QWidget(this);
    auto *root = new QVBoxLayout(central);
    root->setContentsMargins(8, 8, 8, 8);

    m_tabs = new MainTabWidget(this, this);
    m_tabs->setObjectName(QStringLiteral("mainTabWidget"));
    m_dashboardPanel = new DashboardPanelWidget(this);
    m_projectPanel = new ProjectPanelWidget(this);
    m_memberPanel = new MemberPanelWidget(this);
    m_departmentPanel = new DepartmentPanelWidget(this);
    m_debugHub = new DebugHubWidget(this);
    m_tabs->addTab(m_dashboardPanel, QStringLiteral("总览看板"));
    m_tabs->addTab(m_projectPanel, QStringLiteral("项目面板"));
    m_tabs->addTab(m_memberPanel, QStringLiteral("项目成员"));
    m_tabs->addTab(m_departmentPanel, QStringLiteral("部门管理"));
    m_tabs->addTab(m_debugHub, QStringLiteral("调试"));
    root->addWidget(m_tabs, 1);

    connect(m_tabs, &QTabWidget::currentChanged, this, &MainWindow::onMainTabChanged);

    setCentralWidget(central);

    AppLogger::instance().info(QStringLiteral("App"),
                               QStringLiteral("主窗口已启动，%1，后端：%2")
                                   .arg(AppVersion::display(), serverBaseUrl()));

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

        const QJsonObject settings = obj.value(QStringLiteral("settings")).toObject();
        const QString url = settings.value(QStringLiteral("server_base_url")).toString();
        if (!url.isEmpty())
            setServerBaseUrl(url);

        DebugAccess::instance().applyFromSettings(
            settings.value(QStringLiteral("debug_password_enabled")).toBool(false),
            settings.value(QStringLiteral("debug_password")).toString());
    });
}

int MainWindow::dashboardTabIndex() const
{
    if (!m_dashboardPanel || !m_tabs)
        return 0;
    const int idx = m_tabs->indexOf(m_dashboardPanel);
    return idx >= 0 ? idx : 0;
}

int MainWindow::projectTabIndex() const
{
    if (!m_projectPanel || !m_tabs)
        return 0;
    const int idx = m_tabs->indexOf(m_projectPanel);
    return idx >= 0 ? idx : 0;
}

bool MainWindow::allowTabBarSwitch(int index)
{
    if (m_guardingTabSwitch || !m_tabs || !m_debugHub)
        return true;

    const int debugIndex = m_tabs->indexOf(m_debugHub);
    if (index != debugIndex)
        return true;

    return tryEnterDebugTab();
}

bool MainWindow::tryEnterDebugTab()
{
    if (!DebugAccess::instance().isEnabled())
        return true;
    if (m_debugTabAuthorized)
        return true;
    if (!promptDebugAccess())
        return false;

    m_debugTabAuthorized = true;
    return true;
}

bool MainWindow::promptDebugAccess()
{
    bool ok = false;
    const QString password = QInputDialog::getText(
        this,
        QStringLiteral("调试入口"),
        QStringLiteral("请输入调试密码："),
        QLineEdit::Password,
        QString(),
        &ok);
    if (!ok)
        return false;
    return DebugAccess::instance().verify(password);
}

void MainWindow::onMainTabChanged(int index)
{
    if (m_guardingTabSwitch || !m_tabs || !m_debugHub)
        return;

    const int debugIndex = m_tabs->indexOf(m_debugHub);
    if (index != debugIndex) {
        m_debugTabAuthorized = false;
        m_lastNonDebugTabIndex = index;
        return;
    }

    if (!DebugAccess::instance().isEnabled())
        return;

    if (m_debugTabAuthorized)
        return;

    m_guardingTabSwitch = true;
    const int fallback = m_lastNonDebugTabIndex >= 0 ? m_lastNonDebugTabIndex : projectTabIndex();
    m_tabs->setCurrentIndex(fallback);
    m_guardingTabSwitch = false;

    if (tryEnterDebugTab()) {
        m_guardingTabSwitch = true;
        m_tabs->setCurrentIndex(debugIndex);
        m_guardingTabSwitch = false;
    }
}
