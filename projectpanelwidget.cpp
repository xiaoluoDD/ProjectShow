#include "projectpanelwidget.h"

#include "applogger.h"
#include "mainwindow.h"
#include "projecteditdialog.h"

#include <QAbstractItemView>
#include <QHeaderView>
#include <QHBoxLayout>
#include <QSizePolicy>
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
#include <QUrl>
#include <QVBoxLayout>

namespace {

const char kRequestKind[] = "requestKind";
const char kOwnerPanel[] = "ownerPanel";

enum ProjectColumn {
    ColYear = 0,
    ColWorkNo,
    ColName,
    ColManager,
    ColStatus,
    ColStartDate,
    ColEndDate,
    ColTasks,
    ColCount,
};

} // namespace

ProjectPanelWidget::ProjectPanelWidget(QWidget *parent)
    : QWidget(parent)
{
    auto *root = new QVBoxLayout(this);
    root->setContentsMargins(0, 8, 0, 0);

    auto *title = new QLabel(QStringLiteral("项目看板"), this);
    title->setObjectName(QStringLiteral("pageTitle"));
    root->addWidget(title);

    m_notifyTargetLabel = new QLabel(this);
    m_notifyTargetLabel->setObjectName(QStringLiteral("accentText"));
    root->addWidget(m_notifyTargetLabel);

    m_statusLabel = new QLabel(
        QStringLiteral("支持项目增删改；负责人请在「项目成员」中同步后，于编辑时选择。"), this);
    m_statusLabel->setObjectName(QStringLiteral("pageHint"));
    m_statusLabel->setWordWrap(true);
    root->addWidget(m_statusLabel);

    auto *tool = new QHBoxLayout;
    m_addBtn = new QPushButton(QStringLiteral("新增项目"), this);
    m_addBtn->setObjectName(QStringLiteral("btnPrimary"));
    m_editBtn = new QPushButton(QStringLiteral("编辑"), this);
    m_delBtn = new QPushButton(QStringLiteral("删除"), this);
    m_delBtn->setObjectName(QStringLiteral("btnDanger"));
    m_refreshBtn = new QPushButton(QStringLiteral("刷新"), this);
    tool->addWidget(m_addBtn);
    tool->addWidget(m_editBtn);
    tool->addWidget(m_delBtn);
    tool->addWidget(m_refreshBtn);
    tool->addStretch();
    root->addLayout(tool);

    m_projectTable = new QTableWidget(this);
    m_projectTable->setObjectName(QStringLiteral("dataTable"));
    setupProjectTable();
    root->addWidget(m_projectTable, 1);

    auto *btnRow = new QHBoxLayout;
    m_sendBtn = new QPushButton(QStringLiteral("向当前选中成员发送提醒"), this);
    m_sendBtn->setObjectName(QStringLiteral("btnAction"));
    btnRow->addWidget(m_sendBtn);
    btnRow->addStretch();
    root->addLayout(btnRow);

    connect(m_refreshBtn, &QPushButton::clicked, this, &ProjectPanelWidget::onRefreshClicked);
    connect(m_addBtn, &QPushButton::clicked, this, &ProjectPanelWidget::onAddClicked);
    connect(m_editBtn, &QPushButton::clicked, this, &ProjectPanelWidget::onEditClicked);
    connect(m_delBtn, &QPushButton::clicked, this, &ProjectPanelWidget::onDeleteClicked);
    connect(m_sendBtn, &QPushButton::clicked, this, &ProjectPanelWidget::onSendNotifyClicked);
    connect(mainWindow(), &MainWindow::memberSelectionChanged, this,
            &ProjectPanelWidget::onMemberSelectionChanged);
    connect(mainWindow()->networkManager(), &QNetworkAccessManager::finished, this,
            &ProjectPanelWidget::onReplyFinished);

    updateNotifyTargetLabel();
    onRefreshClicked();
}

MainWindow *ProjectPanelWidget::mainWindow() const
{
    return qobject_cast<MainWindow *>(window());
}

void ProjectPanelWidget::setupProjectTable()
{
    m_projectTable->setColumnCount(ColCount);
    m_projectTable->setHorizontalHeaderLabels({
        QStringLiteral("年度"), QStringLiteral("工番号"), QStringLiteral("项目名称"),
        QStringLiteral("项目负责人"), QStringLiteral("项目状态"),
        QStringLiteral("项目启动日期"), QStringLiteral("项目完结日期"), QStringLiteral("项目任务"),
    });

    m_projectTable->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);
    m_projectTable->setMinimumHeight(280);
    m_projectTable->verticalHeader()->setVisible(false);

    auto *header = m_projectTable->horizontalHeader();
    header->setMinimumSectionSize(56);
    header->setStretchLastSection(true);
    for (int col = 0; col < ColCount; ++col) {
        if (col == ColName || col == ColTasks)
            header->setSectionResizeMode(col, QHeaderView::Stretch);
        else
            header->setSectionResizeMode(col, QHeaderView::ResizeToContents);
    }

    m_projectTable->setSelectionBehavior(QAbstractItemView::SelectRows);
    m_projectTable->setSelectionMode(QAbstractItemView::SingleSelection);
    m_projectTable->setEditTriggers(QAbstractItemView::NoEditTriggers);
    m_projectTable->setAlternatingRowColors(true);
    m_projectTable->setHorizontalScrollMode(QAbstractItemView::ScrollPerPixel);
}

void ProjectPanelWidget::adjustProjectTableColumns()
{
    auto *header = m_projectTable->horizontalHeader();
    header->setStretchLastSection(true);
    header->setSectionResizeMode(ColName, QHeaderView::Stretch);
    header->setSectionResizeMode(ColTasks, QHeaderView::Stretch);
    for (int col = 0; col < ColCount; ++col) {
        if (col != ColName && col != ColTasks)
            header->resizeSection(col, header->sectionSizeHint(col));
    }
}

void ProjectPanelWidget::fillProjects(const QJsonArray &projects)
{
    m_projectTable->setRowCount(projects.size());
    for (int r = 0; r < projects.size(); ++r) {
        const QJsonObject p = projects.at(r).toObject();
        const qint64 id = static_cast<qint64>(p.value(QStringLiteral("id")).toDouble());

        auto setCell = [&](int col, const QString &text) {
            auto *item = new QTableWidgetItem(text);
            item->setData(Qt::UserRole, id);
            m_projectTable->setItem(r, col, item);
        };

        setCell(ColYear, p.value(QStringLiteral("year")).toString());
        m_projectTable->item(r, ColYear)->setData(Qt::UserRole + 1, QJsonDocument(p).toJson(QJsonDocument::Compact));

        setCell(ColWorkNo, p.value(QStringLiteral("work_no")).toString());
        setCell(ColName, p.value(QStringLiteral("name")).toString());
        setCell(ColManager, p.value(QStringLiteral("manager_name")).toString());
        setCell(ColStatus, p.value(QStringLiteral("status")).toString());
        setCell(ColStartDate, p.value(QStringLiteral("start_date")).toString());
        setCell(ColEndDate, p.value(QStringLiteral("end_date")).toString());
        setCell(ColTasks, p.value(QStringLiteral("tasks")).toString());
    }
    adjustProjectTableColumns();
}

QJsonObject ProjectPanelWidget::selectedProject() const
{
    const int row = m_projectTable->currentRow();
    if (row < 0)
        return {};
    const QTableWidgetItem *item = m_projectTable->item(row, ColYear);
    if (!item)
        return {};
    const QByteArray json = item->data(Qt::UserRole + 1).toByteArray();
    QJsonParseError err;
    const QJsonDocument doc = QJsonDocument::fromJson(json, &err);
    if (err.error != QJsonParseError::NoError || !doc.isObject())
        return {};
    return doc.object();
}

void ProjectPanelWidget::updateNotifyTargetLabel()
{
    m_notifyTargetLabel->setText(
        QStringLiteral("当前通知对象（成员）：%1").arg(mainWindow()->selectedMemberDisplay()));
}

void ProjectPanelWidget::onMemberSelectionChanged(const QString &userid, const QString &name)
{
    Q_UNUSED(userid);
    Q_UNUSED(name);
    updateNotifyTargetLabel();
}

void ProjectPanelWidget::setBusy(bool busy)
{
    m_refreshBtn->setEnabled(!busy);
    m_addBtn->setEnabled(!busy);
    m_editBtn->setEnabled(!busy);
    m_delBtn->setEnabled(!busy);
    m_sendBtn->setEnabled(!busy);
    // 勿禁用表格：Windows 下 setEnabled(false) 会缩小 sizeHint，导致表格区域塌陷
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

void ProjectPanelWidget::startGet(const QString &path, ProjectPanelRequests::Kind kind)
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

void ProjectPanelWidget::startPost(const QString &path, ProjectPanelRequests::Kind kind, const QByteArray &body)
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

void ProjectPanelWidget::startPut(const QString &path, ProjectPanelRequests::Kind kind, const QByteArray &body)
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

void ProjectPanelWidget::startDelete(int projectId)
{
    QString base;
    if (!checkServerUrl(&base))
        return;
    setBusy(true);
    const QUrl endpoint(base + QStringLiteral("/api/projects?id=") + QString::number(projectId));
    QNetworkRequest netRequest;
    netRequest.setUrl(endpoint);
    QNetworkReply *reply = mainWindow()->networkManager()->deleteResource(netRequest);
    reply->setProperty(kRequestKind, static_cast<int>(ProjectPanelRequests::Kind::DeleteProject));
    reply->setProperty(kOwnerPanel, reinterpret_cast<quintptr>(this));
}

void ProjectPanelWidget::onRefreshClicked()
{
    m_statusLabel->setText(QStringLiteral("正在加载项目 …"));
    startGet(QStringLiteral("/api/projects"), ProjectPanelRequests::Kind::LoadProjects);
}

void ProjectPanelWidget::loadMembersForDialog(ProjectPanelRequests::PendingAction action, const QJsonObject &editExisting)
{
    m_pendingAction = action;
    m_pendingEditProject = editExisting;
    startGet(QStringLiteral("/api/wecom/users"), ProjectPanelRequests::Kind::LoadMembers);
}

void ProjectPanelWidget::showProjectDialog(const QJsonObject &existing)
{
    ProjectEditDialog dlg(m_members, existing, this);
    if (dlg.exec() != QDialog::Accepted)
        return;

    const QJsonObject payload = dlg.projectJson();
    if (payload.value(QStringLiteral("name")).toString().isEmpty()) {
        QMessageBox::warning(this, QStringLiteral("提示"), QStringLiteral("项目名称不能为空"));
        return;
    }

    const QByteArray body = QJsonDocument(payload).toJson(QJsonDocument::Compact);
    if (dlg.isEditMode())
        startPut(QStringLiteral("/api/projects"), ProjectPanelRequests::Kind::UpdateProject, body);
    else
        startPost(QStringLiteral("/api/projects"), ProjectPanelRequests::Kind::CreateProject, body);
}

void ProjectPanelWidget::onAddClicked()
{
    loadMembersForDialog(ProjectPanelRequests::PendingAction::OpenAddDialog);
}

void ProjectPanelWidget::onEditClicked()
{
    const QJsonObject p = selectedProject();
    if (p.isEmpty()) {
        QMessageBox::warning(this, QStringLiteral("提示"), QStringLiteral("请先选中一行项目"));
        return;
    }
    loadMembersForDialog(ProjectPanelRequests::PendingAction::OpenEditDialog, p);
}

void ProjectPanelWidget::onDeleteClicked()
{
    const QJsonObject p = selectedProject();
    if (p.isEmpty()) {
        QMessageBox::warning(this, QStringLiteral("提示"), QStringLiteral("请先选中一行项目"));
        return;
    }
    const int id = p.value(QStringLiteral("id")).toInt();
    const auto ret = QMessageBox::question(
        this, QStringLiteral("确认删除"),
        QStringLiteral("确定删除项目「%1」？").arg(p.value(QStringLiteral("name")).toString()));
    if (ret != QMessageBox::Yes)
        return;
    startDelete(id);
}

void ProjectPanelWidget::onSendNotifyClicked()
{
    const QString userid = mainWindow()->selectedMemberUserId();
    if (userid.isEmpty()) {
        QMessageBox::warning(this, QStringLiteral("提示"), QStringLiteral("请先在「项目成员」页选中一名成员"));
        return;
    }
    QJsonObject body;
    body.insert(QStringLiteral("userid"), userid);
    const QString name = mainWindow()->selectedMemberName();
    if (!name.isEmpty())
        body.insert(QStringLiteral("name"), name);
    startPost(QStringLiteral("/api/wecom/test"), ProjectPanelRequests::Kind::SendNotify,
              QJsonDocument(body).toJson(QJsonDocument::Compact));
}

void ProjectPanelWidget::onReplyFinished(QNetworkReply *reply)
{
    if (reply->property(kOwnerPanel).toULongLong() != reinterpret_cast<quintptr>(this))
        return;

    const auto kind = static_cast<ProjectPanelRequests::Kind>(reply->property(kRequestKind).toInt());
    reply->deleteLater();
    setBusy(false);

    if (reply->error() != QNetworkReply::NoError) {
        m_statusLabel->setText(QStringLiteral("失败：%1").arg(reply->errorString()));
        QMessageBox::critical(this, QStringLiteral("网络错误"), reply->errorString());
        m_pendingAction = ProjectPanelRequests::PendingAction::None;
        return;
    }

    QJsonParseError parseErr;
    const QJsonDocument doc = QJsonDocument::fromJson(reply->readAll(), &parseErr);
    if (parseErr.error != QJsonParseError::NoError || !doc.isObject()) {
        m_statusLabel->setText(QStringLiteral("响应解析失败"));
        m_pendingAction = ProjectPanelRequests::PendingAction::None;
        return;
    }

    const QJsonObject obj = doc.object();
    const bool ok = obj.value(QStringLiteral("ok")).toBool(false);

    if (kind == ProjectPanelRequests::Kind::LoadMembers) {
        if (ok)
            m_members = obj.value(QStringLiteral("users")).toArray();
        const ProjectPanelRequests::PendingAction pending = m_pendingAction;
        m_pendingAction = ProjectPanelRequests::PendingAction::None;
        if (pending == ProjectPanelRequests::PendingAction::OpenAddDialog)
            showProjectDialog(QJsonObject());
        else if (pending == ProjectPanelRequests::PendingAction::OpenEditDialog)
            showProjectDialog(m_pendingEditProject);
        return;
    }

    if (kind == ProjectPanelRequests::Kind::LoadProjects) {
        if (!ok) {
            QMessageBox::critical(this, QStringLiteral("加载失败"), obj.value(QStringLiteral("error")).toString());
            return;
        }
        fillProjects(obj.value(QStringLiteral("projects")).toArray());
        m_statusLabel->setText(QStringLiteral("已加载 %1 个项目").arg(obj.value(QStringLiteral("count")).toInt()));
        return;
    }

    if (kind == ProjectPanelRequests::Kind::CreateProject || kind == ProjectPanelRequests::Kind::UpdateProject) {
        if (!ok) {
            QMessageBox::critical(this, QStringLiteral("保存失败"), obj.value(QStringLiteral("error")).toString());
            return;
        }
        QMessageBox::information(this, QStringLiteral("成功"), obj.value(QStringLiteral("msg")).toString());
        onRefreshClicked();
        setBusy(true);
        return;
    }

    if (kind == ProjectPanelRequests::Kind::DeleteProject) {
        if (!ok) {
            QMessageBox::critical(this, QStringLiteral("删除失败"), obj.value(QStringLiteral("error")).toString());
            return;
        }
        QMessageBox::information(this, QStringLiteral("成功"), obj.value(QStringLiteral("msg")).toString());
        onRefreshClicked();
        setBusy(true);
        return;
    }

    if (kind == ProjectPanelRequests::Kind::SendNotify) {
        if (ok)
            QMessageBox::information(this, QStringLiteral("成功"),
                                     QStringLiteral("已发送至 %1").arg(obj.value(QStringLiteral("to_user")).toString()));
        else
            QMessageBox::critical(this, QStringLiteral("失败"), obj.value(QStringLiteral("error")).toString());
    }
}
