#include "projecteditdialog.h"

#include "datepickerutils.h"

#include <QComboBox>
#include <QDate>
#include <QDateEdit>
#include <QDialogButtonBox>
#include <QFormLayout>
#include <QFrame>
#include <QLabel>
#include <QLineEdit>
#include <QListWidget>
#include <QMessageBox>
#include <QScrollArea>
#include <QVBoxLayout>

namespace {

const int kDeptPlaceholderId = -1;

} // namespace

ProjectEditDialog::ProjectEditDialog(const QJsonArray &members, const QJsonArray &departments,
                                     const QJsonObject &existing, QWidget *parent)
    : QDialog(parent)
    , m_allMembers(members)
    , m_allDepartments(departments)
    , m_existing(existing)
    , m_editMode(static_cast<qint64>(existing.value(QStringLiteral("id")).toDouble()) > 0)
{
    setWindowTitle(m_editMode ? QStringLiteral("编辑项目") : QStringLiteral("新建项目"));
    resize(540, 640);

    auto *root = new QVBoxLayout(this);

    auto *scroll = new QScrollArea(this);
    scroll->setWidgetResizable(true);
    scroll->setFrameShape(QFrame::NoFrame);
    auto *scrollBody = new QWidget(scroll);
    scroll->setWidget(scrollBody);
    root->addWidget(scroll, 1);

    auto *form = new QFormLayout(scrollBody);
    m_yearEdit = new QLineEdit(scrollBody);
    m_workNoEdit = new QLineEdit(scrollBody);
    m_nameEdit = new QLineEdit(scrollBody);
    m_managerCombo = new QComboBox(scrollBody);
    m_managerCombo->addItem(QStringLiteral("（未指定）"), QString());

    m_managerDeptCombo = new QComboBox(scrollBody);
    populateDepartmentCombo(m_managerDeptCombo);

    m_memberDeptCombo = new QComboBox(scrollBody);
    populateDepartmentCombo(m_memberDeptCombo);

    m_membersList = new QListWidget(scrollBody);
    m_membersList->setMaximumHeight(130);
    m_membersList->setEnabled(false);

    m_selectedCountLabel = new QLabel(QStringLiteral("已选成员：0 人"), scrollBody);
    m_selectedCountLabel->setObjectName(QStringLiteral("pageHint"));

    m_selectedMembersSummary = new QLabel(QStringLiteral("（暂无）"), scrollBody);
    m_selectedMembersSummary->setWordWrap(true);
    m_selectedMembersSummary->setObjectName(QStringLiteral("pageHint"));

    m_startDateEdit = DatePickerUtils::createOptionalDateEdit(scrollBody);
    DatePickerUtils::setDateEditPickerTitle(m_startDateEdit, QStringLiteral("项目启动日期"));
    m_actualEndDateEdit = DatePickerUtils::createOptionalDateEdit(scrollBody);
    DatePickerUtils::setDateEditPickerTitle(m_actualEndDateEdit, QStringLiteral("实际完结日期"));

    form->addRow(QStringLiteral("年度"), m_yearEdit);
    form->addRow(QStringLiteral("工番号"), m_workNoEdit);
    form->addRow(QStringLiteral("项目名称"), m_nameEdit);
    form->addRow(QStringLiteral("负责人部门"), m_managerDeptCombo);
    form->addRow(QStringLiteral("项目负责人"), m_managerCombo);
    form->addRow(QStringLiteral("成员部门"), m_memberDeptCombo);
    form->addRow(QStringLiteral("项目成员"), m_membersList);
    form->addRow(QString(), m_selectedCountLabel);
    form->addRow(QStringLiteral("已选名单"), m_selectedMembersSummary);
    form->addRow(QStringLiteral("项目启动日期"), m_startDateEdit);
    form->addRow(QStringLiteral("实际完结日期"), m_actualEndDateEdit);

    auto *statusHint = new QLabel(
        QStringLiteral("项目状态由启动日期与实际完结日期自动计算（待启动 / 进行中 / 已完结）。"), scrollBody);
    statusHint->setWordWrap(true);
    statusHint->setObjectName(QStringLiteral("pageHint"));
    form->addRow(QStringLiteral("项目状态"), statusHint);

    auto *taskHint = new QLabel(
        QStringLiteral("项目任务由子任务组成，请在项目列表双击「项目任务」列进行管理。"), scrollBody);
    taskHint->setWordWrap(true);
    taskHint->setObjectName(QStringLiteral("pageHint"));
    form->addRow(QStringLiteral("项目任务"), taskHint);

    auto *hint = new QLabel(
        QStringLiteral("选负责人：先选「负责人部门」，再选「项目负责人」；"
                       "选成员：先选「成员部门」，再勾选「项目成员」。可切换成员部门继续添加。"
                       "新建或新增项目成员后，系统将向其发送「项目加入提醒」（定时启动/完结提醒仍仅发负责人）。"),
        this);
    hint->setWordWrap(true);
    hint->setObjectName(QStringLiteral("pageHint"));
    root->addWidget(hint);

    auto *buttons = new QDialogButtonBox(QDialogButtonBox::Ok | QDialogButtonBox::Cancel, this);
    connect(buttons, &QDialogButtonBox::accepted, this, &QDialog::accept);
    connect(buttons, &QDialogButtonBox::rejected, this, &QDialog::reject);
    root->addWidget(buttons);

    connect(m_managerDeptCombo, QOverload<int>::of(&QComboBox::currentIndexChanged), this,
            &ProjectEditDialog::onManagerDeptChanged);
    connect(m_memberDeptCombo, QOverload<int>::of(&QComboBox::currentIndexChanged), this,
            &ProjectEditDialog::onMemberDeptChanged);
    connect(m_membersList, &QListWidget::itemChanged, this, &ProjectEditDialog::onMemberItemChanged);

    if (m_editMode)
        restoreEditState();
    else {
        m_yearEdit->setText(QString::number(QDate::currentDate().year()));
        DatePickerUtils::setOptionalDate(m_startDateEdit,
                                         QDate::currentDate().toString(Qt::ISODate));
        refreshManagerCombo();
    }
}

bool ProjectEditDialog::isEditMode() const
{
    return m_editMode;
}

void ProjectEditDialog::accept()
{
    syncSelectionsFromList();
    if (DatePickerUtils::optionalDateText(m_startDateEdit).isEmpty()) {
        QMessageBox::warning(this, QStringLiteral("提示"), QStringLiteral("请填写项目启动日期"));
        return;
    }
    if (!DatePickerUtils::optionalDateText(m_actualEndDateEdit).isEmpty()) {
        const int subCount = m_existing.value(QStringLiteral("subtask_count")).toInt();
        const bool allDone = m_existing.value(QStringLiteral("subtask_all_completed")).toBool();
        if (subCount > 0 && !allDone) {
            QMessageBox::warning(
                this, QStringLiteral("子任务未完成"),
                QStringLiteral("存在未完成的子任务，不能填写实际完结日期。\n请先将全部子任务标记为已完结。"));
            return;
        }
    }
    QDialog::accept();
}

void ProjectEditDialog::restoreEditState()
{
    m_yearEdit->setText(m_existing.value(QStringLiteral("year")).toString());
    m_workNoEdit->setText(m_existing.value(QStringLiteral("work_no")).toString());
    m_nameEdit->setText(m_existing.value(QStringLiteral("name")).toString());

    DatePickerUtils::setOptionalDate(m_startDateEdit,
                                     m_existing.value(QStringLiteral("start_date")).toString());
    DatePickerUtils::setOptionalDate(m_actualEndDateEdit,
                                     m_existing.value(QStringLiteral("end_date")).toString());

    for (const QJsonValue &v : m_existing.value(QStringLiteral("members")).toArray()) {
        const QJsonObject m = v.toObject();
        const QString userid = m.value(QStringLiteral("userid")).toString();
        if (!userid.isEmpty())
            m_selectedMembers.insert(userid, m.value(QStringLiteral("name")).toString());
    }

    const QString mgrId = m_existing.value(QStringLiteral("manager_userid")).toString();
    preselectManagerDepartment(mgrId);
    refreshManagerCombo(mgrId);
    int mi = m_managerCombo->findData(mgrId);
    if (mi < 0 && !mgrId.isEmpty()) {
        const QString mgrName = m_existing.value(QStringLiteral("manager_name")).toString();
        QJsonObject mgr;
        mgr.insert(QStringLiteral("userid"), mgrId);
        mgr.insert(QStringLiteral("name"), mgrName);
        m_managerCombo->addItem(memberLabel(mgr), mgrId);
        m_managerCombo->setItemData(m_managerCombo->count() - 1, mgrName, Qt::UserRole + 1);
        mi = m_managerCombo->findData(mgrId);
    }
    if (mi >= 0)
        m_managerCombo->setCurrentIndex(mi);

    preselectMemberDepartment();
    updateSelectedCountLabel();
}

qlonglong ProjectEditDialog::departmentIdForUser(const QString &userid) const
{
    if (userid.isEmpty())
        return kDeptPlaceholderId;
    for (const QJsonValue &v : m_allMembers) {
        const QJsonObject u = v.toObject();
        if (u.value(QStringLiteral("userid")).toString() == userid)
            return userDepartmentId(u);
    }
    return kDeptPlaceholderId;
}

void ProjectEditDialog::populateDepartmentCombo(QComboBox *combo)
{
    combo->addItem(QStringLiteral("（请先选择部门）"), kDeptPlaceholderId);
    for (const QJsonValue &v : m_allDepartments) {
        const QJsonObject d = v.toObject();
        combo->addItem(d.value(QStringLiteral("name")).toString(),
                       static_cast<qlonglong>(d.value(QStringLiteral("id")).toDouble()));
    }
    combo->addItem(QStringLiteral("（未分配）"), static_cast<qlonglong>(0));
}

void ProjectEditDialog::preselectManagerDepartment(const QString &userid)
{
    const qlonglong deptId = departmentIdForUser(userid);
    if (deptId == kDeptPlaceholderId)
        return;

    const int idx = m_managerDeptCombo->findData(deptId);
    if (idx >= 0)
        m_managerDeptCombo->setCurrentIndex(idx);
}

void ProjectEditDialog::preselectMemberDepartment()
{
    if (m_selectedMembers.isEmpty())
        return;

    const qlonglong deptId = departmentIdForUser(m_selectedMembers.constBegin().key());
    if (deptId == kDeptPlaceholderId)
        return;

    const int idx = m_memberDeptCombo->findData(deptId);
    if (idx >= 0)
        m_memberDeptCombo->setCurrentIndex(idx);
    else
        refreshMemberList();
}

QString ProjectEditDialog::memberLabel(const QJsonObject &user)
{
    const QString userid = user.value(QStringLiteral("userid")).toString();
    const QString name = user.value(QStringLiteral("name")).toString();
    return name.isEmpty() ? userid : QStringLiteral("%1 (%2)").arg(name, userid);
}

qlonglong ProjectEditDialog::userDepartmentId(const QJsonObject &user)
{
    return static_cast<qlonglong>(user.value(QStringLiteral("department_id")).toDouble());
}

void ProjectEditDialog::onManagerDeptChanged(int index)
{
    Q_UNUSED(index);
    const QString keepManagerId = m_managerCombo->currentData().toString();
    refreshManagerCombo(keepManagerId);
}

void ProjectEditDialog::onMemberDeptChanged(int index)
{
    Q_UNUSED(index);
    refreshMemberList();
}

void ProjectEditDialog::refreshManagerCombo(const QString &selectUserid)
{
    const qlonglong deptId = m_managerDeptCombo->currentData().toLongLong();
    const QString prevId = selectUserid.isEmpty() ? m_managerCombo->currentData().toString()
                                                  : selectUserid;

    m_managerCombo->clear();
    m_managerCombo->addItem(QStringLiteral("（未指定）"), QString());

    if (deptId == kDeptPlaceholderId) {
        m_managerCombo->setEnabled(false);
        return;
    }

    m_managerCombo->setEnabled(true);
    for (const QJsonValue &v : m_allMembers) {
        const QJsonObject u = v.toObject();
        if (userDepartmentId(u) != deptId)
            continue;

        const QString userid = u.value(QStringLiteral("userid")).toString();
        const QString name = u.value(QStringLiteral("name")).toString();
        m_managerCombo->addItem(memberLabel(u), userid);
        m_managerCombo->setItemData(m_managerCombo->count() - 1, name, Qt::UserRole + 1);
    }

    const int idx = m_managerCombo->findData(prevId);
    if (idx >= 0)
        m_managerCombo->setCurrentIndex(idx);
}

void ProjectEditDialog::syncSelectionsFromList()
{
    if (m_updatingMemberList)
        return;
    for (int i = 0; i < m_membersList->count(); ++i) {
        QListWidgetItem *item = m_membersList->item(i);
        if ((item->flags() & Qt::ItemIsUserCheckable) == 0)
            continue;
        const QString userid = item->data(Qt::UserRole).toString();
        if (item->checkState() == Qt::Checked)
            m_selectedMembers.insert(userid, item->data(Qt::UserRole + 1).toString());
        else
            m_selectedMembers.remove(userid);
    }
    updateSelectedCountLabel();
}

void ProjectEditDialog::onMemberItemChanged(QListWidgetItem *item)
{
    if (m_updatingMemberList || !item)
        return;
    const QString userid = item->data(Qt::UserRole).toString();
    if (item->checkState() == Qt::Checked)
        m_selectedMembers.insert(userid, item->data(Qt::UserRole + 1).toString());
    else
        m_selectedMembers.remove(userid);
    updateSelectedCountLabel();
}

void ProjectEditDialog::updateSelectedCountLabel()
{
    m_selectedCountLabel->setText(
        QStringLiteral("已选成员：%1 人").arg(QString::number(m_selectedMembers.size())));

    QStringList names;
    for (auto it = m_selectedMembers.constBegin(); it != m_selectedMembers.constEnd(); ++it) {
        const QString name = it.value().trimmed();
        names.append(name.isEmpty() ? it.key() : name);
    }
    m_selectedMembersSummary->setText(names.isEmpty() ? QStringLiteral("（暂无）") : names.join(QStringLiteral("、")));
}

void ProjectEditDialog::refreshMemberList()
{
    syncSelectionsFromList();

    const qlonglong deptId = m_memberDeptCombo->currentData().toLongLong();
    m_updatingMemberList = true;
    m_membersList->clear();

    if (deptId == kDeptPlaceholderId) {
        m_membersList->setEnabled(false);
        auto *hint = new QListWidgetItem(QStringLiteral("请先在上方选择成员部门"), m_membersList);
        hint->setFlags(Qt::NoItemFlags);
        m_updatingMemberList = false;
        return;
    }

    m_membersList->setEnabled(true);
    for (const QJsonValue &v : m_allMembers) {
        const QJsonObject u = v.toObject();
        if (userDepartmentId(u) != deptId)
            continue;

        const QString userid = u.value(QStringLiteral("userid")).toString();
        const QString name = u.value(QStringLiteral("name")).toString();
        auto *item = new QListWidgetItem(memberLabel(u), m_membersList);
        item->setFlags(item->flags() | Qt::ItemIsUserCheckable);
        item->setData(Qt::UserRole, userid);
        item->setData(Qt::UserRole + 1, name);
        item->setCheckState(m_selectedMembers.contains(userid) ? Qt::Checked : Qt::Unchecked);
    }

    if (m_membersList->count() == 0) {
        auto *empty = new QListWidgetItem(QStringLiteral("该部门暂无成员"), m_membersList);
        empty->setFlags(Qt::NoItemFlags);
    }

    m_updatingMemberList = false;
}

QJsonObject ProjectEditDialog::projectJson()
{
    QJsonObject o;
    if (m_editMode)
        o.insert(QStringLiteral("id"), static_cast<int>(m_existing.value(QStringLiteral("id")).toDouble()));

    o.insert(QStringLiteral("year"), m_yearEdit->text().trimmed());
    o.insert(QStringLiteral("work_no"), m_workNoEdit->text().trimmed());
    o.insert(QStringLiteral("name"), m_nameEdit->text().trimmed());

    const int mi = m_managerCombo->currentIndex();
    o.insert(QStringLiteral("manager_userid"), m_managerCombo->itemData(mi).toString());
    o.insert(QStringLiteral("manager_name"), m_managerCombo->itemData(mi, Qt::UserRole + 1).toString());

    QJsonArray memberArr;
    for (auto it = m_selectedMembers.constBegin(); it != m_selectedMembers.constEnd(); ++it) {
        QJsonObject m;
        m.insert(QStringLiteral("userid"), it.key());
        m.insert(QStringLiteral("name"), it.value());
        memberArr.append(m);
    }
    o.insert(QStringLiteral("members"), memberArr);

    if (m_editMode) {
        o.insert(QStringLiteral("group_chat"), m_existing.value(QStringLiteral("group_chat")).toString());
        o.insert(QStringLiteral("group_chat_id"), m_existing.value(QStringLiteral("group_chat_id")).toString());
        o.insert(QStringLiteral("tasks"), m_existing.value(QStringLiteral("tasks")).toString());
    } else {
        o.insert(QStringLiteral("group_chat"), QString());
        o.insert(QStringLiteral("group_chat_id"), QString());
        o.insert(QStringLiteral("tasks"), QString());
    }
    o.insert(QStringLiteral("start_date"), DatePickerUtils::optionalDateText(m_startDateEdit));
    o.insert(QStringLiteral("end_date"), DatePickerUtils::optionalDateText(m_actualEndDateEdit));
    return o;
}
