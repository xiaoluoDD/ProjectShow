#include "projectpanelwidget.h"

#include "applogger.h"
#include "mainwindow.h"
#include "projecteditdialog.h"
#include "projectdetaildialog.h"
#include "projectsubtaskdialog.h"

#include <QAbstractItemView>
#include <QHeaderView>
#include <QHBoxLayout>
#include <QSizePolicy>
#include <QInputDialog>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QLabel>
#include <QMessageBox>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QPushButton>
#include <QSet>
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
    ColMembers,
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
        QStringLiteral("支持项目增删改；双击「项目任务」列管理子任务，双击其他列查看项目详情。"),
        this);
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
    m_sendBtn = new QPushButton(QStringLiteral("向选中项目成员发送提醒"), this);
    m_sendBtn->setObjectName(QStringLiteral("btnAction"));
    btnRow->addWidget(m_sendBtn);
    btnRow->addStretch();
    root->addLayout(btnRow);

    connect(m_refreshBtn, &QPushButton::clicked, this, &ProjectPanelWidget::onRefreshClicked);
    connect(m_addBtn, &QPushButton::clicked, this, &ProjectPanelWidget::onAddClicked);
    connect(m_editBtn, &QPushButton::clicked, this, &ProjectPanelWidget::onEditClicked);
    connect(m_delBtn, &QPushButton::clicked, this, &ProjectPanelWidget::onDeleteClicked);
    connect(m_sendBtn, &QPushButton::clicked, this, &ProjectPanelWidget::onSendNotifyClicked);
    connect(m_projectTable, &QTableWidget::itemSelectionChanged, this,
            &ProjectPanelWidget::updateNotifyTargetLabel);
    connect(m_projectTable, &QTableWidget::cellDoubleClicked, this,
            &ProjectPanelWidget::onProjectDoubleClicked);
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
        QStringLiteral("项目成员"),
    });

    m_projectTable->setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Expanding);
    m_projectTable->setMinimumHeight(280);
    m_projectTable->verticalHeader()->setVisible(false);

    auto *header = m_projectTable->horizontalHeader();
    header->setMinimumSectionSize(56);
    header->setStretchLastSection(true);
    for (int col = 0; col < ColCount; ++col) {
        if (col == ColName || col == ColTasks || col == ColMembers)
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
    header->setSectionResizeMode(ColMembers, QHeaderView::Stretch);
    for (int col = 0; col < ColCount; ++col) {
        if (col != ColName && col != ColTasks && col != ColMembers)
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
        setCell(ColMembers, formatMembersSummary(p));
    }
    adjustProjectTableColumns();
}

QString ProjectPanelWidget::formatMembersSummary(const QJsonObject &project)
{
    const QJsonArray members = project.value(QStringLiteral("members")).toArray();
    if (members.isEmpty())
        return QStringLiteral("—");

    QStringList names;
    for (const QJsonValue &v : members) {
        const QJsonObject m = v.toObject();
        const QString name = m.value(QStringLiteral("name")).toString();
        const QString userid = m.value(QStringLiteral("userid")).toString();
        names.append(name.isEmpty() ? userid : name);
    }
    return QStringLiteral("%1（共 %2 人）").arg(names.join(QStringLiteral("、")), QString::number(names.size()));
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
    const QJsonObject p = selectedProject();
    if (p.isEmpty()) {
        m_notifyTargetLabel->setText(QStringLiteral("提醒对象：请先在项目表中选中一行"));
        return;
    }

    QSet<QString> recipientIds;
    const QString mgrId = p.value(QStringLiteral("manager_userid")).toString();
    if (!mgrId.isEmpty())
        recipientIds.insert(mgrId);
    for (const QJsonValue &v : p.value(QStringLiteral("members")).toArray()) {
        const QString uid = v.toObject().value(QStringLiteral("userid")).toString();
        if (!uid.isEmpty())
            recipientIds.insert(uid);
    }

    const QString projectName = p.value(QStringLiteral("name")).toString();
    if (recipientIds.isEmpty()) {
        m_notifyTargetLabel->setText(
            QStringLiteral("提醒对象：项目「%1」尚未配置负责人或成员，请先编辑项目")
                .arg(projectName));
        return;
    }

    m_notifyTargetLabel->setText(
        QStringLiteral("提醒对象：项目「%1」负责人及成员，共 %2 人")
            .arg(projectName, QString::number(recipientIds.size())));
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
    if (m_pendingAction == ProjectPanelRequests::PendingAction::OpenEditDialog) {
        const qint64 id = static_cast<qint64>(existing.value(QStringLiteral("id")).toDouble());
        if (id <= 0) {
            QMessageBox::warning(this, QStringLiteral("提示"),
                                 QStringLiteral("无法加载项目数据，请先点击「刷新」后重试。"));
            return;
        }
    }

    ProjectEditDialog dlg(m_members, m_departments, existing, this);
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
    const int id = static_cast<int>(p.value(QStringLiteral("id")).toDouble());
    if (id <= 0) {
        QMessageBox::warning(this, QStringLiteral("提示"), QStringLiteral("无法读取项目 ID，请先点击「刷新」"));
        return;
    }

    m_editFallbackProject = p;
    m_pendingEditProject = p;
    m_pendingAction = ProjectPanelRequests::PendingAction::OpenEditDialog;
    m_statusLabel->setText(QStringLiteral("正在加载项目信息 …"));
    startGet(QStringLiteral("/api/projects?id=") + QString::number(id),
             ProjectPanelRequests::Kind::LoadProjectForEdit);
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

void ProjectPanelWidget::onProjectDoubleClicked(int row, int column)
{
    if (row < 0 || row >= m_projectTable->rowCount())
        return;

    m_projectTable->selectRow(row);
    const QJsonObject p = selectedProject();
    if (p.isEmpty())
        return;

    if (column == ColTasks) {
        showSubTaskDialog(p);
        return;
    }

    m_pendingDetailProject = p;
    m_statusLabel->setText(QStringLiteral("正在加载项目详情 …"));
    startGet(QStringLiteral("/api/wecom/users"), ProjectPanelRequests::Kind::LoadUsersForDetail);
}

void ProjectPanelWidget::showSubTaskDialog(const QJsonObject &project)
{
    ProjectSubTaskDialog dlg(project, this);
    dlg.exec();
}

void ProjectPanelWidget::showProjectDetail(const QJsonObject &project)
{
    ProjectDetailDialog dlg(project, this);
    dlg.exec();
}

void ProjectPanelWidget::onSendNotifyClicked()
{
    const QJsonObject p = selectedProject();
    if (p.isEmpty()) {
        QMessageBox::warning(this, QStringLiteral("提示"), QStringLiteral("请先在项目表中选中一行"));
        return;
    }

    bool ok = false;
    const QString extra = QInputDialog::getMultiLineText(
        this, QStringLiteral("项目提醒"),
        QStringLiteral("可选附加说明（留空则仅发送项目关键信息）："), QString(), &ok);
    if (!ok)
        return;

    QJsonObject body;
    body.insert(QStringLiteral("project_id"), p.value(QStringLiteral("id")).toInt());
    if (!extra.trimmed().isEmpty())
        body.insert(QStringLiteral("content"), extra.trimmed());

    startPost(QStringLiteral("/api/wecom/notify-project"), ProjectPanelRequests::Kind::SendNotify,
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
        if (kind == ProjectPanelRequests::Kind::LoadProjectForEdit
            && m_pendingAction == ProjectPanelRequests::PendingAction::OpenEditDialog
            && static_cast<qint64>(m_editFallbackProject.value(QStringLiteral("id")).toDouble()) > 0) {
            m_pendingEditProject = m_editFallbackProject;
            loadMembersForDialog(ProjectPanelRequests::PendingAction::OpenEditDialog, m_pendingEditProject);
            return;
        }
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

    if (kind == ProjectPanelRequests::Kind::LoadProjectForEdit) {
        QJsonObject project = m_editFallbackProject;
        if (ok) {
            const QJsonObject fromApi = obj.value(QStringLiteral("project")).toObject();
            if (static_cast<qint64>(fromApi.value(QStringLiteral("id")).toDouble()) > 0)
                project = fromApi;
        } else {
            QMessageBox::warning(
                this, QStringLiteral("提示"),
                QStringLiteral("未能从服务器拉取最新项目，将使用列表中的数据进行编辑。\n%1")
                    .arg(obj.value(QStringLiteral("error")).toString()));
        }
        if (static_cast<qint64>(project.value(QStringLiteral("id")).toDouble()) <= 0) {
            m_pendingAction = ProjectPanelRequests::PendingAction::None;
            QMessageBox::warning(this, QStringLiteral("提示"),
                                 QStringLiteral("无法加载项目数据，请先点击「刷新」后重试。"));
            return;
        }
        m_pendingEditProject = project;
        loadMembersForDialog(ProjectPanelRequests::PendingAction::OpenEditDialog, m_pendingEditProject);
        return;
    }

    if (kind == ProjectPanelRequests::Kind::LoadMembers) {
        if (ok)
            m_members = obj.value(QStringLiteral("users")).toArray();
        if (!ok) {
            m_pendingAction = ProjectPanelRequests::PendingAction::None;
            QMessageBox::critical(this, QStringLiteral("加载失败"), obj.value(QStringLiteral("error")).toString());
            return;
        }
        startGet(QStringLiteral("/api/departments"), ProjectPanelRequests::Kind::LoadDepartments);
        setBusy(true);
        return;
    }

    if (kind == ProjectPanelRequests::Kind::LoadUsersForDetail) {
        if (!ok) {
            QMessageBox::critical(this, QStringLiteral("加载失败"), obj.value(QStringLiteral("error")).toString());
            m_pendingDetailProject = QJsonObject();
            return;
        }
        const QJsonArray users = obj.value(QStringLiteral("users")).toArray();
        const QJsonObject enriched =
            ProjectDetailDialog::enrichMembersWithUsers(m_pendingDetailProject, users);
        m_pendingDetailProject = QJsonObject();
        showProjectDetail(enriched);
        return;
    }

    if (kind == ProjectPanelRequests::Kind::LoadDepartments) {
        if (ok)
            m_departments = obj.value(QStringLiteral("departments")).toArray();
        const ProjectPanelRequests::PendingAction pending = m_pendingAction;
        m_pendingAction = ProjectPanelRequests::PendingAction::None;
        if (!ok) {
            QMessageBox::critical(this, QStringLiteral("加载失败"), obj.value(QStringLiteral("error")).toString());
            return;
        }
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
        if (ok) {
            const int count = obj.value(QStringLiteral("count")).toInt();
            const QJsonArray users = obj.value(QStringLiteral("to_users")).toArray();
            QStringList ids;
            for (const QJsonValue &v : users)
                ids.append(v.toString());
            QMessageBox::information(
                this, QStringLiteral("成功"),
                QStringLiteral("已向 %1 人发送项目提醒：\n%2")
                    .arg(QString::number(count), ids.join(QStringLiteral("、"))));
        } else {
            QMessageBox::critical(this, QStringLiteral("失败"), obj.value(QStringLiteral("error")).toString());
        }
    }
}
