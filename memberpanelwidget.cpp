#include "memberpanelwidget.h"

#include "applogger.h"
#include "mainwindow.h"
#include "membereditdialog.h"

#include <QAbstractItemView>
#include <QHeaderView>
#include <QHBoxLayout>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QLabel>
#include <QMessageBox>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QPushButton>
#include <QSettings>
#include <QTableWidget>
#include <QTableWidgetItem>
#include <QColor>
#include <QUrl>
#include <QVBoxLayout>

namespace {

const char kRequestKind[] = "requestKind";
const char kOwnerPanel[] = "ownerPanel";

enum MemberColumn {
    ColName = 0,
    ColUserID,
    ColMobile,
    ColDepartment,
    ColSources,
    ColCount,
};

} // namespace

MemberPanelWidget::MemberPanelWidget(QWidget *parent)
    : QWidget(parent)
{
    auto *root = new QVBoxLayout(this);
    root->setContentsMargins(0, 8, 0, 0);

    auto *title = new QLabel(QStringLiteral("项目成员"), this);
    title->setObjectName(QStringLiteral("pageTitle"));
    root->addWidget(title);

    m_hintLabel = new QLabel(
        QStringLiteral("从企业微信同步可见成员；部门需手动维护。双击成员行可编辑手机号与部门并保存到后端。"),
        this);
    m_hintLabel->setObjectName(QStringLiteral("pageHint"));
    m_hintLabel->setWordWrap(true);
    root->addWidget(m_hintLabel);

    auto *tool = new QHBoxLayout;
    m_syncBtn = new QPushButton(QStringLiteral("同步可见成员"), this);
    m_syncBtn->setObjectName(QStringLiteral("btnPrimary"));
    m_refreshBtn = new QPushButton(QStringLiteral("刷新列表"), this);
    tool->addWidget(m_syncBtn);
    tool->addWidget(m_refreshBtn);
    tool->addStretch();
    m_countLabel = new QLabel(QStringLiteral("共 0 人"), this);
    tool->addWidget(m_countLabel);
    root->addLayout(tool);

    m_table = new QTableWidget(this);
    m_table->setObjectName(QStringLiteral("dataTable"));
    m_table->setColumnCount(ColCount);
    m_table->setHorizontalHeaderLabels({
        QStringLiteral("姓名"),
        QStringLiteral("UserID"),
        QStringLiteral("手机"),
        QStringLiteral("部门"),
        QStringLiteral("来源"),
    });
    m_table->horizontalHeader()->setStretchLastSection(true);
    m_table->horizontalHeader()->setSectionResizeMode(ColName, QHeaderView::ResizeToContents);
    m_table->horizontalHeader()->setSectionResizeMode(ColUserID, QHeaderView::Stretch);
    m_table->horizontalHeader()->setSectionResizeMode(ColDepartment, QHeaderView::Stretch);
    m_table->setSelectionBehavior(QAbstractItemView::SelectRows);
    m_table->setSelectionMode(QAbstractItemView::SingleSelection);
    m_table->setEditTriggers(QAbstractItemView::NoEditTriggers);
    m_table->setAlternatingRowColors(true);
    root->addWidget(m_table, 1);

    connect(m_syncBtn, &QPushButton::clicked, this, &MemberPanelWidget::onSyncClicked);
    connect(m_refreshBtn, &QPushButton::clicked, this, &MemberPanelWidget::onRefreshClicked);
    connect(m_table, &QTableWidget::itemSelectionChanged, this, &MemberPanelWidget::onSelectionChanged);
    connect(m_table, &QTableWidget::cellDoubleClicked, this, &MemberPanelWidget::onMemberDoubleClicked);
    connect(mainWindow()->networkManager(), &QNetworkAccessManager::finished, this,
            &MemberPanelWidget::onReplyFinished);

    onRefreshClicked();
}

MainWindow *MemberPanelWidget::mainWindow() const
{
    return qobject_cast<MainWindow *>(window());
}

bool MemberPanelWidget::checkServerUrl(QString *baseOut)
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

void MemberPanelWidget::setBusy(bool busy)
{
    m_syncBtn->setEnabled(!busy);
    m_refreshBtn->setEnabled(!busy);
}

void MemberPanelWidget::startGet(const QString &path, MemberPanelRequests::Kind kind)
{
    QString base;
    if (!checkServerUrl(&base))
        return;

    setBusy(true);
    QNetworkRequest netRequest;
    netRequest.setUrl(QUrl(base + path));
    QNetworkReply *reply = mainWindow()->networkManager()->get(netRequest);
    reply->setProperty(kRequestKind, static_cast<int>(kind));
    reply->setProperty(kOwnerPanel, reinterpret_cast<quintptr>(this));
}

void MemberPanelWidget::startPost(const QString &path, MemberPanelRequests::Kind kind, const QByteArray &body)
{
    QString base;
    if (!checkServerUrl(&base))
        return;

    setBusy(true);
    QNetworkRequest netRequest;
    netRequest.setUrl(QUrl(base + path));
    netRequest.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
    QNetworkReply *reply = mainWindow()->networkManager()->post(netRequest, body);
    reply->setProperty(kRequestKind, static_cast<int>(kind));
    reply->setProperty(kOwnerPanel, reinterpret_cast<quintptr>(this));
}

void MemberPanelWidget::startPut(const QString &path, MemberPanelRequests::Kind kind, const QByteArray &body)
{
    QString base;
    if (!checkServerUrl(&base))
        return;

    setBusy(true);
    QNetworkRequest netRequest;
    netRequest.setUrl(QUrl(base + path));
    netRequest.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
    QNetworkReply *reply = mainWindow()->networkManager()->put(netRequest, body);
    reply->setProperty(kRequestKind, static_cast<int>(kind));
    reply->setProperty(kOwnerPanel, reinterpret_cast<quintptr>(this));
}

void MemberPanelWidget::onSyncClicked()
{
    AppLogger::instance().info(QStringLiteral("Member"), QStringLiteral("开始同步可见成员"));
    startPost(QStringLiteral("/api/wecom/sync"), MemberPanelRequests::Kind::Sync);
}

void MemberPanelWidget::onRefreshClicked()
{
    startGet(QStringLiteral("/api/wecom/users"), MemberPanelRequests::Kind::LoadUsers);
}

QString MemberPanelWidget::formatDepartmentText(const QJsonObject &user)
{
    const QString deptName = user.value(QStringLiteral("department_name")).toString().trimmed();
    if (!deptName.isEmpty())
        return deptName;
    const QString legacy = user.value(QStringLiteral("departments")).toString().trimmed();
    return legacy.isEmpty() ? QStringLiteral("—") : legacy;
}

void MemberPanelWidget::showMembers(const QJsonArray &users)
{
    m_users = users;
    m_table->setRowCount(users.size());

    for (int i = 0; i < users.size(); ++i) {
        const QJsonObject u = users.at(i).toObject();
        const QString userid = u.value(QStringLiteral("userid")).toString();
        QString name = u.value(QStringLiteral("name")).toString().trimmed();
        if (name.isEmpty())
            name = QStringLiteral("—");
        const QString mobile = u.value(QStringLiteral("mobile")).toString();
        const QString sources = u.value(QStringLiteral("sources")).toString();

        auto *nameItem = new QTableWidgetItem(name);
        nameItem->setData(Qt::UserRole, userid);
        nameItem->setData(Qt::UserRole + 1, QJsonDocument(u).toJson(QJsonDocument::Compact));
        if (name == QStringLiteral("—"))
            nameItem->setForeground(QColor(Qt::gray));

        m_table->setItem(i, ColName, nameItem);
        m_table->setItem(i, ColUserID, new QTableWidgetItem(userid));
        m_table->setItem(i, ColMobile, new QTableWidgetItem(mobile.isEmpty() ? QStringLiteral("—") : mobile));
        m_table->setItem(i, ColDepartment, new QTableWidgetItem(formatDepartmentText(u)));
        m_table->setItem(i, ColSources, new QTableWidgetItem(sources));
    }

    m_countLabel->setText(QStringLiteral("共 %1 人").arg(users.size()));
}

QJsonObject MemberPanelWidget::selectedUser() const
{
    const int row = m_table->currentRow();
    if (row < 0)
        return {};
    const QTableWidgetItem *item = m_table->item(row, ColName);
    if (!item)
        return {};
    const QByteArray json = item->data(Qt::UserRole + 1).toByteArray();
    QJsonParseError err;
    const QJsonDocument doc = QJsonDocument::fromJson(json, &err);
    if (err.error != QJsonParseError::NoError || !doc.isObject())
        return {};
    return doc.object();
}

void MemberPanelWidget::applyRowSelection(int row)
{
    if (row < 0 || row >= m_table->rowCount()) {
        mainWindow()->setSelectedMember(QString(), QString());
        return;
    }

    const QTableWidgetItem *nameItem = m_table->item(row, ColName);
    if (!nameItem)
        return;

    const QString userid = nameItem->data(Qt::UserRole).toString();
    const QJsonObject u = selectedUser();
    const QString name = u.value(QStringLiteral("name")).toString();
    mainWindow()->setSelectedMember(userid, name);
}

void MemberPanelWidget::onSelectionChanged()
{
    applyRowSelection(m_table->currentRow());
}

void MemberPanelWidget::loadDepartmentsForDialog(const QJsonObject &editUser)
{
    m_pendingAction = MemberPanelRequests::PendingAction::OpenEditDialog;
    m_pendingEditUser = editUser;
    startGet(QStringLiteral("/api/departments"), MemberPanelRequests::Kind::LoadDepartments);
}

void MemberPanelWidget::showMemberDialog(const QJsonObject &user)
{
    MemberEditDialog dlg(user, m_departments, this);
    if (dlg.exec() != QDialog::Accepted)
        return;

    const QJsonObject payload = dlg.savePayload();
    startPut(QStringLiteral("/api/wecom/users"), MemberPanelRequests::Kind::UpdateUser,
             QJsonDocument(payload).toJson(QJsonDocument::Compact));
}

void MemberPanelWidget::onMemberDoubleClicked(int row, int column)
{
    Q_UNUSED(column);
    if (row < 0 || row >= m_table->rowCount())
        return;

    m_table->selectRow(row);
    const QJsonObject u = selectedUser();
    if (u.isEmpty())
        return;
    loadDepartmentsForDialog(u);
}

void MemberPanelWidget::onReplyFinished(QNetworkReply *reply)
{
    if (reply->property(kOwnerPanel).toULongLong() != reinterpret_cast<quintptr>(this))
        return;

    const auto kind = static_cast<MemberPanelRequests::Kind>(reply->property(kRequestKind).toInt());
    reply->deleteLater();
    setBusy(false);

    if (reply->error() != QNetworkReply::NoError) {
        AppLogger::instance().error(QStringLiteral("Member"), reply->errorString());
        QMessageBox::critical(this, QStringLiteral("网络错误"), reply->errorString());
        m_pendingAction = MemberPanelRequests::PendingAction::None;
        return;
    }

    const QByteArray body = reply->readAll();
    QJsonParseError parseErr;
    const QJsonDocument doc = QJsonDocument::fromJson(body, &parseErr);
    if (parseErr.error != QJsonParseError::NoError || !doc.isObject()) {
        QMessageBox::warning(this, QStringLiteral("解析失败"), QStringLiteral("响应不是合法 JSON"));
        m_pendingAction = MemberPanelRequests::PendingAction::None;
        return;
    }

    const QJsonObject obj = doc.object();
    const bool ok = obj.value(QStringLiteral("ok")).toBool(false);

    if (kind == MemberPanelRequests::Kind::LoadDepartments) {
        if (ok)
            m_departments = obj.value(QStringLiteral("departments")).toArray();
        const MemberPanelRequests::PendingAction pending = m_pendingAction;
        m_pendingAction = MemberPanelRequests::PendingAction::None;
        if (pending == MemberPanelRequests::PendingAction::OpenEditDialog)
            showMemberDialog(m_pendingEditUser);
        return;
    }

    if (kind == MemberPanelRequests::Kind::Sync) {
        if (!ok) {
            QMessageBox::critical(this, QStringLiteral("同步失败"),
                                  obj.value(QStringLiteral("error")).toString());
            return;
        }
        const QJsonObject sync = obj.value(QStringLiteral("sync")).toObject();
        const int count = sync.value(QStringLiteral("user_count")).toInt();
        AppLogger::instance().info(QStringLiteral("Member"), QStringLiteral("同步完成 %1 人").arg(count));
        QMessageBox::information(this, QStringLiteral("同步成功"),
                                 QStringLiteral("已同步 %1 名成员。").arg(count));
        onRefreshClicked();
        setBusy(true);
        return;
    }

    if (kind == MemberPanelRequests::Kind::LoadUsers) {
        if (!ok) {
            QMessageBox::critical(this, QStringLiteral("加载失败"),
                                  obj.value(QStringLiteral("error")).toString());
            return;
        }
        const QJsonArray users = obj.value(QStringLiteral("users")).toArray();
        showMembers(users);
        AppLogger::instance().info(QStringLiteral("Member"),
                                   QStringLiteral("成员列表已加载，共 %1 人").arg(users.size()));
        if (users.isEmpty()) {
            QMessageBox::information(this, QStringLiteral("提示"), QStringLiteral("暂无成员，请先同步。"));
        }
        return;
    }

    if (kind == MemberPanelRequests::Kind::UpdateUser) {
        if (!ok) {
            QMessageBox::critical(this, QStringLiteral("保存失败"), obj.value(QStringLiteral("error")).toString());
            return;
        }
        QMessageBox::information(this, QStringLiteral("成功"), obj.value(QStringLiteral("msg")).toString());
        onRefreshClicked();
        setBusy(true);
    }
}
