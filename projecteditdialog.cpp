#include "projecteditdialog.h"

#include <QComboBox>
#include <QDate>
#include <QDialogButtonBox>
#include <QFormLayout>
#include <QLabel>
#include <QLineEdit>
#include <QListWidget>
#include <QTextEdit>
#include <QVBoxLayout>

namespace {

const int kDeptPlaceholderId = -1;

} // namespace

ProjectEditDialog::ProjectEditDialog(const QJsonArray &members, const QJsonArray &departments,
                                     const QJsonObject &existing, QWidget *parent)
    : QDialog(parent)
    , m_allMembers(members)
    , m_existing(existing)
    , m_editMode(existing.contains(QStringLiteral("id")) && existing.value(QStringLiteral("id")).toInt() > 0)
{
    setWindowTitle(m_editMode ? QStringLiteral("编辑项目") : QStringLiteral("新建项目"));
    resize(520, 600);

    auto *root = new QVBoxLayout(this);

    auto *form = new QFormLayout;
    m_yearEdit = new QLineEdit(this);
    m_workNoEdit = new QLineEdit(this);
    m_nameEdit = new QLineEdit(this);
    m_managerCombo = new QComboBox(this);
    m_managerCombo->addItem(QStringLiteral("（未指定）"), QString());
    for (const QJsonValue &v : members) {
        const QJsonObject u = v.toObject();
        const QString userid = u.value(QStringLiteral("userid")).toString();
        const QString name = u.value(QStringLiteral("name")).toString();
        m_managerCombo->addItem(memberLabel(u), userid);
        m_managerCombo->setItemData(m_managerCombo->count() - 1, name, Qt::UserRole + 1);
    }

    m_memberDeptCombo = new QComboBox(this);
    m_memberDeptCombo->addItem(QStringLiteral("（请先选择部门）"), kDeptPlaceholderId);
    for (const QJsonValue &v : departments) {
        const QJsonObject d = v.toObject();
        m_memberDeptCombo->addItem(d.value(QStringLiteral("name")).toString(),
                                   static_cast<qlonglong>(d.value(QStringLiteral("id")).toDouble()));
    }
    m_memberDeptCombo->addItem(QStringLiteral("（未分配）"), static_cast<qlonglong>(0));

    m_membersList = new QListWidget(this);
    m_membersList->setMaximumHeight(130);
    m_membersList->setEnabled(false);

    m_selectedCountLabel = new QLabel(QStringLiteral("已选成员：0 人"), this);
    m_selectedCountLabel->setObjectName(QStringLiteral("pageHint"));

    m_statusCombo = new QComboBox(this);
    m_statusCombo->setEditable(true);
    m_statusCombo->addItems({QStringLiteral("待启动"), QStringLiteral("进行中"),
                             QStringLiteral("暂停"), QStringLiteral("已完结")});
    m_startDateEdit = new QLineEdit(this);
    m_startDateEdit->setPlaceholderText(QStringLiteral("YYYY-MM-DD"));
    m_endDateEdit = new QLineEdit(this);
    m_endDateEdit->setPlaceholderText(QStringLiteral("YYYY-MM-DD"));
    m_tasksEdit = new QTextEdit(this);
    m_tasksEdit->setMaximumHeight(100);

    form->addRow(QStringLiteral("年度"), m_yearEdit);
    form->addRow(QStringLiteral("工番号"), m_workNoEdit);
    form->addRow(QStringLiteral("项目名称"), m_nameEdit);
    form->addRow(QStringLiteral("项目负责人"), m_managerCombo);
    form->addRow(QStringLiteral("筛选部门"), m_memberDeptCombo);
    form->addRow(QStringLiteral("项目成员"), m_membersList);
    form->addRow(QString(), m_selectedCountLabel);
    form->addRow(QStringLiteral("项目状态"), m_statusCombo);
    form->addRow(QStringLiteral("启动日期"), m_startDateEdit);
    form->addRow(QStringLiteral("完结日期"), m_endDateEdit);
    form->addRow(QStringLiteral("项目任务"), m_tasksEdit);
    root->addLayout(form);

    auto *hint = new QLabel(
        QStringLiteral("添加成员时请先选择部门，再从该部门勾选成员；可切换部门继续添加。提醒将发送给负责人与已选成员。"),
        this);
    hint->setWordWrap(true);
    hint->setObjectName(QStringLiteral("pageHint"));
    root->addWidget(hint);

    auto *buttons = new QDialogButtonBox(QDialogButtonBox::Ok | QDialogButtonBox::Cancel, this);
    connect(buttons, &QDialogButtonBox::accepted, this, &QDialog::accept);
    connect(buttons, &QDialogButtonBox::rejected, this, &QDialog::reject);
    root->addWidget(buttons);

    connect(m_memberDeptCombo, QOverload<int>::of(&QComboBox::currentIndexChanged), this,
            &ProjectEditDialog::onMemberDeptChanged);
    connect(m_membersList, &QListWidget::itemChanged, this, &ProjectEditDialog::onMemberItemChanged);

    if (m_editMode) {
        m_yearEdit->setText(existing.value(QStringLiteral("year")).toString());
        m_workNoEdit->setText(existing.value(QStringLiteral("work_no")).toString());
        m_nameEdit->setText(existing.value(QStringLiteral("name")).toString());
        const QString status = existing.value(QStringLiteral("status")).toString();
        const int si = m_statusCombo->findText(status);
        if (si >= 0)
            m_statusCombo->setCurrentIndex(si);
        else if (!status.isEmpty())
            m_statusCombo->setEditText(status);
        m_startDateEdit->setText(existing.value(QStringLiteral("start_date")).toString());
        m_endDateEdit->setText(existing.value(QStringLiteral("end_date")).toString());
        m_tasksEdit->setPlainText(existing.value(QStringLiteral("tasks")).toString());

        const QString mgrId = existing.value(QStringLiteral("manager_userid")).toString();
        const int mi = m_managerCombo->findData(mgrId);
        if (mi >= 0)
            m_managerCombo->setCurrentIndex(mi);

        for (const QJsonValue &v : existing.value(QStringLiteral("members")).toArray()) {
            const QJsonObject m = v.toObject();
            const QString userid = m.value(QStringLiteral("userid")).toString();
            if (!userid.isEmpty())
                m_selectedMembers.insert(userid, m.value(QStringLiteral("name")).toString());
        }
        updateSelectedCountLabel();
    } else {
        m_yearEdit->setText(QString::number(QDate::currentDate().year()));
    }
}

bool ProjectEditDialog::isEditMode() const
{
    return m_editMode;
}

void ProjectEditDialog::accept()
{
    syncSelectionsFromList();
    QDialog::accept();
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

void ProjectEditDialog::onMemberDeptChanged(int index)
{
    Q_UNUSED(index);
    refreshMemberList();
}

void ProjectEditDialog::syncSelectionsFromList()
{
    if (m_updatingMemberList)
        return;
    for (int i = 0; i < m_membersList->count(); ++i) {
        QListWidgetItem *item = m_membersList->item(i);
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
}

void ProjectEditDialog::refreshMemberList()
{
    syncSelectionsFromList();

    const qlonglong deptId = m_memberDeptCombo->currentData().toLongLong();
    m_updatingMemberList = true;
    m_membersList->clear();

    if (deptId == kDeptPlaceholderId) {
        m_membersList->setEnabled(false);
        auto *hint = new QListWidgetItem(QStringLiteral("请先在上方选择部门"), m_membersList);
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
        o.insert(QStringLiteral("id"), m_existing.value(QStringLiteral("id")).toInt());

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
    } else {
        o.insert(QStringLiteral("group_chat"), QString());
        o.insert(QStringLiteral("group_chat_id"), QString());
    }
    o.insert(QStringLiteral("status"), m_statusCombo->currentText());
    o.insert(QStringLiteral("start_date"), m_startDateEdit->text().trimmed());
    o.insert(QStringLiteral("end_date"), m_endDateEdit->text().trimmed());
    o.insert(QStringLiteral("tasks"), m_tasksEdit->toPlainText().trimmed());
    return o;
}
