#include "projecteditdialog.h"

#include <QComboBox>
#include <QDate>
#include <QDialogButtonBox>
#include <QFormLayout>
#include <QLabel>
#include <QLineEdit>
#include <QListWidget>
#include <QSet>
#include <QTextEdit>
#include <QVBoxLayout>

ProjectEditDialog::ProjectEditDialog(const QJsonArray &members, const QJsonObject &existing,
                                     QWidget *parent)
    : QDialog(parent)
    , m_existing(existing)
    , m_editMode(existing.contains(QStringLiteral("id")) && existing.value(QStringLiteral("id")).toInt() > 0)
{
    setWindowTitle(m_editMode ? QStringLiteral("编辑项目") : QStringLiteral("新建项目"));
    resize(520, 560);

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
        const QString label = name.isEmpty() ? userid : QStringLiteral("%1 (%2)").arg(name, userid);
        m_managerCombo->addItem(label, userid);
        m_managerCombo->setItemData(m_managerCombo->count() - 1, name, Qt::UserRole + 1);
    }

    m_membersList = new QListWidget(this);
    m_membersList->setMaximumHeight(130);
    for (const QJsonValue &v : members) {
        const QJsonObject u = v.toObject();
        const QString userid = u.value(QStringLiteral("userid")).toString();
        const QString name = u.value(QStringLiteral("name")).toString();
        const QString label = name.isEmpty() ? userid : QStringLiteral("%1 (%2)").arg(name, userid);
        auto *item = new QListWidgetItem(label, m_membersList);
        item->setFlags(item->flags() | Qt::ItemIsUserCheckable);
        item->setCheckState(Qt::Unchecked);
        item->setData(Qt::UserRole, userid);
        item->setData(Qt::UserRole + 1, name);
    }

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
    form->addRow(QStringLiteral("项目成员"), m_membersList);
    form->addRow(QStringLiteral("项目状态"), m_statusCombo);
    form->addRow(QStringLiteral("启动日期"), m_startDateEdit);
    form->addRow(QStringLiteral("完结日期"), m_endDateEdit);
    form->addRow(QStringLiteral("项目任务"), m_tasksEdit);
    root->addLayout(form);

    auto *hint = new QLabel(
        QStringLiteral("提醒时将向「负责人 + 已勾选成员」发送，消息包含项目名称、工番、状态、周期、任务等。"),
        this);
    hint->setWordWrap(true);
    hint->setObjectName(QStringLiteral("pageHint"));
    root->addWidget(hint);

    auto *buttons = new QDialogButtonBox(QDialogButtonBox::Ok | QDialogButtonBox::Cancel, this);
    connect(buttons, &QDialogButtonBox::accepted, this, &QDialog::accept);
    connect(buttons, &QDialogButtonBox::rejected, this, &QDialog::reject);
    root->addWidget(buttons);

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

        QSet<QString> selectedMembers;
        for (const QJsonValue &v : existing.value(QStringLiteral("members")).toArray()) {
            selectedMembers.insert(v.toObject().value(QStringLiteral("userid")).toString());
        }
        for (int i = 0; i < m_membersList->count(); ++i) {
            QListWidgetItem *item = m_membersList->item(i);
            if (selectedMembers.contains(item->data(Qt::UserRole).toString()))
                item->setCheckState(Qt::Checked);
        }
    } else {
        m_yearEdit->setText(QString::number(QDate::currentDate().year()));
    }
}

bool ProjectEditDialog::isEditMode() const
{
    return m_editMode;
}

QJsonObject ProjectEditDialog::projectJson() const
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
    for (int i = 0; i < m_membersList->count(); ++i) {
        const QListWidgetItem *item = m_membersList->item(i);
        if (item->checkState() != Qt::Checked)
            continue;
        QJsonObject m;
        m.insert(QStringLiteral("userid"), item->data(Qt::UserRole).toString());
        m.insert(QStringLiteral("name"), item->data(Qt::UserRole + 1).toString());
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
