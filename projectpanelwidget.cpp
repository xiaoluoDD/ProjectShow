#include "projectpanelwidget.h"

#include "applogger.h"
#include "mainwindow.h"

#include <QAbstractItemView>
#include <QHeaderView>
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
#include <QSplitter>
#include <QTableWidget>
#include <QTableWidgetItem>
#include <QUrl>
#include <QVBoxLayout>

namespace {

const char kRequestKind[] = "requestKind";
const char kOwnerPanel[] = "ownerPanel";

} // namespace

ProjectPanelWidget::ProjectPanelWidget(QWidget *parent)
    : QWidget(parent)
{
    auto *root = new QVBoxLayout(this);
    root->setContentsMargins(0, 8, 0, 0);

    auto *title = new QLabel(QStringLiteral("项目看板"), this);
    title->setStyleSheet(QStringLiteral("font-size: 18px; font-weight: bold;"));
    root->addWidget(title);

    m_statusLabel = new QLabel(QStringLiteral("请选择成员后发送项目提醒。"), this);
    m_statusLabel->setStyleSheet(QStringLiteral("color: #444;"));
    root->addWidget(m_statusLabel);

    auto *splitter = new QSplitter(Qt::Horizontal, this);

    auto *left = new QWidget(splitter);
    auto *leftLayout = new QVBoxLayout(left);
    leftLayout->setContentsMargins(0, 0, 0, 0);
    m_memberCountLabel = new QLabel(QStringLiteral("项目成员（0）"), left);
    leftLayout->addWidget(m_memberCountLabel);
    m_memberList = new QListWidget(left);
    m_memberList->setSelectionMode(QAbstractItemView::SingleSelection);
    m_memberList->setMinimumWidth(220);
    leftLayout->addWidget(m_memberList, 1);
    splitter->addWidget(left);

    auto *right = new QWidget(splitter);
    auto *rightLayout = new QVBoxLayout(right);
    rightLayout->setContentsMargins(0, 0, 0, 0);
    rightLayout->addWidget(new QLabel(QStringLiteral("项目列表"), right));
    m_projectTable = new QTableWidget(right);
    setupProjectTable();
    rightLayout->addWidget(m_projectTable, 1);
    splitter->addWidget(right);

    splitter->setStretchFactor(0, 1);
    splitter->setStretchFactor(1, 2);
    root->addWidget(splitter, 1);

    auto *btnRow = new QHBoxLayout;
    m_refreshBtn = new QPushButton(QStringLiteral("刷新成员"), this);
    m_sendBtn = new QPushButton(QStringLiteral("向选中成员发送项目提醒"), this);
    m_sendBtn->setStyleSheet(QStringLiteral("font-weight: bold; padding: 6px 16px;"));
    btnRow->addWidget(m_refreshBtn);
    btnRow->addWidget(m_sendBtn);
    btnRow->addStretch();
    root->addLayout(btnRow);

    connect(m_refreshBtn, &QPushButton::clicked, this, &ProjectPanelWidget::onRefreshMembersClicked);
    connect(m_sendBtn, &QPushButton::clicked, this, &ProjectPanelWidget::onSendNotifyClicked);
    connect(mainWindow()->networkManager(), &QNetworkAccessManager::finished, this,
            &ProjectPanelWidget::onReplyFinished);

    onRefreshMembersClicked();
}

MainWindow *ProjectPanelWidget::mainWindow() const
{
    return qobject_cast<MainWindow *>(window());
}

void ProjectPanelWidget::setupProjectTable()
{
    m_projectTable->setColumnCount(4);
    m_projectTable->setHorizontalHeaderLabels({
        QStringLiteral("项目名称"),
        QStringLiteral("状态"),
        QStringLiteral("负责人"),
        QStringLiteral("更新时间"),
    });
    m_projectTable->horizontalHeader()->setStretchLastSection(true);
    m_projectTable->horizontalHeader()->setSectionResizeMode(0, QHeaderView::Stretch);
    m_projectTable->setSelectionBehavior(QAbstractItemView::SelectRows);
    m_projectTable->setEditTriggers(QAbstractItemView::NoEditTriggers);
    m_projectTable->setAlternatingRowColors(true);

    const QList<QStringList> rows = {
        {QStringLiteral("示例项目 A"), QStringLiteral("进行中"), QStringLiteral("—"), QStringLiteral("—")},
        {QStringLiteral("示例项目 B"), QStringLiteral("待启动"), QStringLiteral("—"), QStringLiteral("—")},
    };
    m_projectTable->setRowCount(rows.size());
    for (int r = 0; r < rows.size(); ++r) {
        for (int c = 0; c < rows[r].size(); ++c) {
            m_projectTable->setItem(r, c, new QTableWidgetItem(rows[r][c]));
        }
    }
}

void ProjectPanelWidget::setStatus(const QString &text)
{
    m_statusLabel->setText(text);
}

void ProjectPanelWidget::setBusy(bool busy)
{
    m_refreshBtn->setEnabled(!busy);
    m_sendBtn->setEnabled(!busy);
    m_memberList->setEnabled(!busy);
}

bool ProjectPanelWidget::checkServerUrl(QString *baseOut)
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

void ProjectPanelWidget::startGet(const QString &path, RequestKind kind)
{
    QString base;
    if (!checkServerUrl(&base))
        return;

    setBusy(true);
    m_statusLabel->setText(QStringLiteral("正在请求 %1 …").arg(path));
    AppLogger::instance().info(QStringLiteral("Project"), QStringLiteral("GET %1%2").arg(base, path));

    QNetworkRequest req(QUrl(base + path));
    QNetworkReply *reply = mainWindow()->networkManager()->get(req);
    reply->setProperty(kRequestKind, static_cast<int>(kind));
    reply->setProperty(kOwnerPanel, reinterpret_cast<quintptr>(this));
}

void ProjectPanelWidget::startPost(const QString &path, RequestKind kind, const QByteArray &body)
{
    QString base;
    if (!checkServerUrl(&base))
        return;

    setBusy(true);
    m_statusLabel->setText(QStringLiteral("正在发送 …"));
    AppLogger::instance().info(QStringLiteral("Project"), QStringLiteral("POST %1%2").arg(base, path));

    QNetworkRequest req(QUrl(base + path));
    req.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
    QNetworkReply *reply = mainWindow()->networkManager()->post(req, body);
    reply->setProperty(kRequestKind, static_cast<int>(kind));
    reply->setProperty(kOwnerPanel, reinterpret_cast<quintptr>(this));
}

void ProjectPanelWidget::onRefreshMembersClicked()
{
    startGet(QStringLiteral("/api/wecom/users"), RequestKind::LoadUsers);
}

void ProjectPanelWidget::onSendNotifyClicked()
{
    const QString userid = selectedMemberUserId();
    if (userid.isEmpty()) {
        QMessageBox::warning(this, QStringLiteral("提示"),
                             QStringLiteral("请先在左侧选中一名成员。\n若列表为空，请点击「刷新成员」或在「调试」页同步。"));
        return;
    }

    const QString name = selectedMemberName();
    QJsonObject body;
    body.insert(QStringLiteral("userid"), userid);
    if (!name.isEmpty())
        body.insert(QStringLiteral("name"), name);

    const QString target = name.isEmpty() ? userid : name;
    m_statusLabel->setText(QStringLiteral("正在向 %1 发送提醒 …").arg(target));
    AppLogger::instance().info(QStringLiteral("Project"),
                               QStringLiteral("向 %1 (%2) 发送项目提醒").arg(target, userid));
    startPost(QStringLiteral("/api/wecom/test"), RequestKind::SendNotify,
              QJsonDocument(body).toJson(QJsonDocument::Compact));
}

void ProjectPanelWidget::showMembers(const QJsonArray &users)
{
    m_memberList->clear();
    for (const QJsonValue &v : users) {
        const QJsonObject u = v.toObject();
        const QString userid = u.value(QStringLiteral("userid")).toString();
        const QString name = u.value(QStringLiteral("name")).toString();
        const QString line = name.isEmpty() ? userid : QStringLiteral("%1").arg(name);
        auto *item = new QListWidgetItem(line, m_memberList);
        item->setData(Qt::UserRole, userid);
        item->setData(Qt::UserRole + 1, name);
        item->setToolTip(userid);
    }
    m_memberCountLabel->setText(QStringLiteral("项目成员（%1）").arg(users.size()));
}

QString ProjectPanelWidget::selectedMemberUserId() const
{
    const QListWidgetItem *item = m_memberList->currentItem();
    return item ? item->data(Qt::UserRole).toString() : QString();
}

QString ProjectPanelWidget::selectedMemberName() const
{
    const QListWidgetItem *item = m_memberList->currentItem();
    return item ? item->data(Qt::UserRole + 1).toString() : QString();
}

void ProjectPanelWidget::onReplyFinished(QNetworkReply *reply)
{
    if (reply->property(kOwnerPanel).toULongLong() != reinterpret_cast<quintptr>(this))
        return;

    const auto kind = static_cast<RequestKind>(reply->property(kRequestKind).toInt());
    reply->deleteLater();
    setBusy(false);

    if (reply->error() != QNetworkReply::NoError) {
        const QString err = reply->errorString();
        setStatus(QStringLiteral("请求失败：%1").arg(err));
        AppLogger::instance().error(
            QStringLiteral("Project"),
            QStringLiteral("网络错误 [%1]: %2").arg(reply->url().path(), err));
        QMessageBox::critical(this, QStringLiteral("网络错误"), err);
        return;
    }

    const QByteArray body = reply->readAll();
    QJsonParseError parseErr;
    const QJsonDocument doc = QJsonDocument::fromJson(body, &parseErr);
    if (parseErr.error != QJsonParseError::NoError || !doc.isObject()) {
        setStatus(QStringLiteral("响应解析失败"));
        return;
    }

    const QJsonObject obj = doc.object();
    const bool ok = obj.value(QStringLiteral("ok")).toBool(false);

    if (kind == RequestKind::LoadUsers) {
        if (!ok) {
            const QString err = obj.value(QStringLiteral("error")).toString();
            setStatus(QStringLiteral("加载成员失败：%1").arg(err));
            AppLogger::instance().error(QStringLiteral("Project"), err);
            if (m_memberList->count() == 0) {
                QMessageBox::information(
                    this, QStringLiteral("提示"),
                    QStringLiteral("暂无成员数据。请到「调试」页执行「同步可见成员」后再刷新。"));
            }
            return;
        }
        const QJsonArray users = obj.value(QStringLiteral("users")).toArray();
        showMembers(users);
        setStatus(QStringLiteral("成员列表已更新，共 %1 人。选中成员后可发送项目提醒。").arg(users.size()));
        AppLogger::instance().info(QStringLiteral("Project"),
                                   QStringLiteral("成员列表已更新，共 %1 人").arg(users.size()));
        return;
    }

    if (kind == RequestKind::SendNotify) {
        if (ok) {
            const QString toUser = obj.value(QStringLiteral("to_user")).toString();
            setStatus(QStringLiteral("已向 %1 发送项目提醒。").arg(toUser));
            AppLogger::instance().info(QStringLiteral("Project"),
                                       QStringLiteral("项目提醒已发送至 %1").arg(toUser));
            QMessageBox::information(this, QStringLiteral("发送成功"),
                                     QStringLiteral("已向 %1 发送企业微信提醒，请让对方查看。").arg(toUser));
        } else {
            const QString err = obj.value(QStringLiteral("error")).toString();
            setStatus(QStringLiteral("发送失败：%1").arg(err));
            AppLogger::instance().error(QStringLiteral("Project"), err);
            QMessageBox::critical(this, QStringLiteral("发送失败"), err);
        }
    }
}
