#include "debugpanelwidget.h"

#include "applogger.h"
#include "mainwindow.h"

#include <QAbstractItemView>
#include <QHBoxLayout>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QLabel>
#include <QListWidget>
#include <QListWidgetItem>
#include <QMessageBox>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QPushButton>
#include <QSettings>
#include <QUrl>
#include <QVBoxLayout>

namespace {

const char kRequestKind[] = "requestKind";
const char kOwnerPanel[] = "ownerPanel";

} // namespace

DebugPanelWidget::DebugPanelWidget(QWidget *parent)
    : QWidget(parent)
{
    auto *root = new QVBoxLayout(this);
    root->setContentsMargins(0, 8, 0, 0);

    auto *hint = new QLabel(
        QStringLiteral("开发调试：连接检测、成员同步、接口测试。正式使用请切换到「项目面板」。"), this);
    hint->setWordWrap(true);
    hint->setStyleSheet(QStringLiteral("color: #666;"));
    root->addWidget(hint);

    auto *btnRow1 = new QHBoxLayout;
    m_pingBtn = new QPushButton(QStringLiteral("检测连接"), this);
    m_sendTestBtn = new QPushButton(QStringLiteral("向选中成员发送测试"), this);
    m_sendTestBtn->setStyleSheet(QStringLiteral("font-weight: bold;"));
    m_sendTestBtn->setToolTip(QStringLiteral("请先在成员列表中选中一人"));
    btnRow1->addWidget(m_pingBtn);
    btnRow1->addWidget(m_sendTestBtn);
    btnRow1->addStretch();
    root->addLayout(btnRow1);

    auto *btnRow2 = new QHBoxLayout;
    m_syncBtn = new QPushButton(QStringLiteral("同步可见成员"), this);
    m_usersBtn = new QPushButton(QStringLiteral("查看已保存成员"), this);
    m_statsBtn = new QPushButton(QStringLiteral("同步概览"), this);
    btnRow2->addWidget(m_syncBtn);
    btnRow2->addWidget(m_usersBtn);
    btnRow2->addWidget(m_statsBtn);
    btnRow2->addStretch();
    root->addLayout(btnRow2);

    root->addWidget(new QLabel(QStringLiteral("可见范围成员："), this));
    m_memberList = new QListWidget(this);
    m_memberList->setSelectionMode(QAbstractItemView::SingleSelection);
    root->addWidget(m_memberList, 1);

    connect(m_pingBtn, &QPushButton::clicked, this, &DebugPanelWidget::onPingClicked);
    connect(m_sendTestBtn, &QPushButton::clicked, this, &DebugPanelWidget::onSendTestClicked);
    connect(m_syncBtn, &QPushButton::clicked, this, &DebugPanelWidget::onSyncClicked);
    connect(m_usersBtn, &QPushButton::clicked, this, &DebugPanelWidget::onUsersClicked);
    connect(m_statsBtn, &QPushButton::clicked, this, &DebugPanelWidget::onStatsClicked);
    connect(mainWindow()->networkManager(), &QNetworkAccessManager::finished, this,
            &DebugPanelWidget::onReplyFinished);

    logInfo(QStringLiteral("调试页就绪，详细输出见「日志」标签。"));
}

MainWindow *DebugPanelWidget::mainWindow() const
{
    return qobject_cast<MainWindow *>(window());
}

void DebugPanelWidget::logInfo(const QString &message) const
{
    AppLogger::instance().info(QStringLiteral("Debug"), message);
}

void DebugPanelWidget::logWarn(const QString &message) const
{
    AppLogger::instance().warn(QStringLiteral("Debug"), message);
}

void DebugPanelWidget::logError(const QString &message) const
{
    AppLogger::instance().error(QStringLiteral("Debug"), message);
}

void DebugPanelWidget::setButtonsEnabled(bool enabled)
{
    m_pingBtn->setEnabled(enabled);
    m_sendTestBtn->setEnabled(enabled);
    m_syncBtn->setEnabled(enabled);
    m_usersBtn->setEnabled(enabled);
    m_statsBtn->setEnabled(enabled);
}

bool DebugPanelWidget::checkServerUrl(QString *baseOut)
{
    const auto *mw = mainWindow();
    if (!mw)
        return false;

    const QString base = mw->serverBaseUrl();
    if (base.isEmpty()) {
        QMessageBox::warning(this, QStringLiteral("提示"), QStringLiteral("请在窗口顶部填写后端地址"));
        return false;
    }
    QSettings settings;
    settings.setValue(QStringLiteral("serverBaseUrl"), base);
    if (baseOut)
        *baseOut = base;
    return true;
}

void DebugPanelWidget::startGet(const QString &path, RequestKind kind)
{
    QString base;
    if (!checkServerUrl(&base))
        return;

    const QUrl targetUrl(base + path);
    logInfo(QStringLiteral("GET %1").arg(targetUrl.toString()));
    setButtonsEnabled(false);

    QNetworkRequest netRequest;
    netRequest.setUrl(targetUrl);
    QNetworkReply *reply = mainWindow()->networkManager()->get(netRequest);
    reply->setProperty(kRequestKind, static_cast<int>(kind));
    reply->setProperty(kOwnerPanel, reinterpret_cast<quintptr>(this));
}

void DebugPanelWidget::startPost(const QString &path, RequestKind kind, const QByteArray &body)
{
    QString base;
    if (!checkServerUrl(&base))
        return;

    const QUrl targetUrl(base + path);
    logInfo(QStringLiteral("POST %1").arg(targetUrl.toString()));
    setButtonsEnabled(false);

    QNetworkRequest netRequest;
    netRequest.setUrl(targetUrl);
    netRequest.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
    QNetworkReply *reply = mainWindow()->networkManager()->post(netRequest, body);
    reply->setProperty(kRequestKind, static_cast<int>(kind));
    reply->setProperty(kOwnerPanel, reinterpret_cast<quintptr>(this));
}

void DebugPanelWidget::onPingClicked()
{
    startGet(QStringLiteral("/ping"), RequestKind::Ping);
}

void DebugPanelWidget::onSendTestClicked()
{
    const QString userid = selectedMemberUserId();
    if (userid.isEmpty()) {
        QMessageBox::warning(this, QStringLiteral("提示"),
                             QStringLiteral("请先在成员列表中选中一名成员。\n若列表为空，请先「同步可见成员」。"));
        return;
    }

    const QString name = selectedMemberName();
    QJsonObject body;
    body.insert(QStringLiteral("userid"), userid);
    if (!name.isEmpty())
        body.insert(QStringLiteral("name"), name);

    logInfo(QStringLiteral("向 %1 (%2) 发送测试").arg(name.isEmpty() ? userid : name, userid));
    startPost(QStringLiteral("/api/wecom/test"), RequestKind::WecomTest,
              QJsonDocument(body).toJson(QJsonDocument::Compact));
}

void DebugPanelWidget::onSyncClicked()
{
    startPost(QStringLiteral("/api/wecom/sync"), RequestKind::WecomSync);
}

void DebugPanelWidget::onUsersClicked()
{
    startGet(QStringLiteral("/api/wecom/users"), RequestKind::WecomUsers);
}

void DebugPanelWidget::onStatsClicked()
{
    startGet(QStringLiteral("/api/wecom/stats"), RequestKind::WecomStats);
}

void DebugPanelWidget::showMembers(const QJsonArray &users, int count)
{
    m_memberList->clear();
    for (const QJsonValue &v : users) {
        const QJsonObject u = v.toObject();
        const QString userid = u.value(QStringLiteral("userid")).toString();
        const QString name = u.value(QStringLiteral("name")).toString();
        const QString sources = u.value(QStringLiteral("sources")).toString();
        QString line = name.isEmpty() ? userid : QStringLiteral("%1 (%2)").arg(name, userid);
        if (!sources.isEmpty())
            line += QStringLiteral("  [%1]").arg(sources);
        auto *item = new QListWidgetItem(line, m_memberList);
        item->setData(Qt::UserRole, userid);
        item->setData(Qt::UserRole + 1, name);
    }
    logInfo(QStringLiteral("成员列表已更新，共 %1 人").arg(count));
}

QString DebugPanelWidget::selectedMemberUserId() const
{
    const QListWidgetItem *item = m_memberList->currentItem();
    return item ? item->data(Qt::UserRole).toString() : QString();
}

QString DebugPanelWidget::selectedMemberName() const
{
    const QListWidgetItem *item = m_memberList->currentItem();
    return item ? item->data(Qt::UserRole + 1).toString() : QString();
}

void DebugPanelWidget::handleJsonError(const QJsonObject &obj, const QString &title)
{
    const QString err = obj.value(QStringLiteral("error")).toString(QStringLiteral("未知错误"));
    logError(title + QStringLiteral("：") + err);
    QMessageBox::critical(this, title, err);
}

void DebugPanelWidget::onReplyFinished(QNetworkReply *reply)
{
    if (reply->property(kOwnerPanel).toULongLong() != reinterpret_cast<quintptr>(this))
        return;

    const auto kind = static_cast<RequestKind>(reply->property(kRequestKind).toInt());

    reply->deleteLater();
    setButtonsEnabled(true);

    const QString path = reply->url().path();

    if (reply->error() != QNetworkReply::NoError) {
        logError(QStringLiteral("失败 [%1]: %2").arg(path, reply->errorString()));
        QMessageBox::critical(this, QStringLiteral("网络错误"),
                              QStringLiteral("无法连接后端：\n%1").arg(reply->errorString()));
        return;
    }

    const QByteArray body = reply->readAll();

    if (kind == RequestKind::Ping) {
        const QString text = QString::fromUtf8(body).trimmed();
        logInfo(QStringLiteral("ping：") + text);
        if (text == QStringLiteral("pong")) {
            QMessageBox::information(this, QStringLiteral("成功"), QStringLiteral("后端连接正常"));
        }
        return;
    }

    QJsonParseError parseErr;
    const QJsonDocument doc = QJsonDocument::fromJson(body, &parseErr);
    if (parseErr.error != QJsonParseError::NoError || !doc.isObject()) {
        logWarn(QStringLiteral("响应：") + QString::fromUtf8(body));
        QMessageBox::warning(this, QStringLiteral("解析失败"), QStringLiteral("响应不是合法 JSON"));
        return;
    }

    const QJsonObject obj = doc.object();
    const bool ok = obj.value(QStringLiteral("ok")).toBool(false);

    switch (kind) {
    case RequestKind::WecomTest:
        if (ok) {
            const QString toUser = obj.value(QStringLiteral("to_user")).toString();
            logInfo(QStringLiteral("已发送至 %1").arg(toUser));
            QMessageBox::information(this, QStringLiteral("成功"),
                                     QStringLiteral("已向 %1 发送测试消息。").arg(toUser));
        } else {
            handleJsonError(obj, QStringLiteral("发送失败"));
        }
        break;

    case RequestKind::WecomSync: {
        const QJsonObject sync = obj.value(QStringLiteral("sync")).toObject();
        if (ok) {
            const int count = sync.value(QStringLiteral("user_count")).toInt();
            logInfo(QStringLiteral("同步完成：%1 人").arg(count));
            QMessageBox::information(this, QStringLiteral("同步成功"),
                                     QStringLiteral("已同步 %1 名成员。").arg(count));
            startGet(QStringLiteral("/api/wecom/users"), RequestKind::WecomUsers);
            setButtonsEnabled(false);
        } else {
            handleJsonError(obj, QStringLiteral("同步失败"));
        }
        break;
    }

    case RequestKind::WecomUsers:
        if (ok) {
            const QJsonArray users = obj.value(QStringLiteral("users")).toArray();
            const int count = obj.value(QStringLiteral("count")).toInt(users.size());
            showMembers(users, count);
        } else {
            handleJsonError(obj, QStringLiteral("获取成员失败"));
        }
        break;

    case RequestKind::WecomStats:
        if (ok) {
            const QJsonObject stats = obj.value(QStringLiteral("stats")).toObject();
            const int active = stats.value(QStringLiteral("active_users")).toInt();
            QMessageBox::information(this, QStringLiteral("同步概览"),
                                     QStringLiteral("当前有效成员：%1 人").arg(active));
        } else {
            handleJsonError(obj, QStringLiteral("获取概览失败"));
        }
        break;

    default:
        logWarn(QString::fromUtf8(body));
        break;
    }
}
