#ifndef PROJECTEDITDIALOG_H
#define PROJECTEDITDIALOG_H

#include <QDialog>
#include <QJsonArray>
#include <QJsonObject>
#include <QMap>

class QComboBox;
class QDateEdit;
class QLineEdit;
class QListWidget;
class QListWidgetItem;
class QLabel;
class QScrollArea;
class QTextEdit;

class ProjectEditDialog : public QDialog
{
    Q_OBJECT

public:
    explicit ProjectEditDialog(const QJsonArray &members, const QJsonArray &departments,
                               const QJsonObject &existing, QWidget *parent = nullptr);

    QJsonObject projectJson();
    bool isEditMode() const;

protected:
    void accept() override;

private slots:
    void onMemberDeptChanged(int index);
    void onMemberItemChanged(QListWidgetItem *item);

private:
    void restoreEditState();
    void refreshMemberList();
    void syncSelectionsFromList();
    void updateSelectedCountLabel();
    qlonglong departmentIdForUser(const QString &userid) const;
    void preselectMemberDepartment();
    static QString memberLabel(const QJsonObject &user);
    static qlonglong userDepartmentId(const QJsonObject &user);

    QLineEdit *m_yearEdit = nullptr;
    QLineEdit *m_workNoEdit = nullptr;
    QLineEdit *m_nameEdit = nullptr;
    QComboBox *m_managerCombo = nullptr;
    QComboBox *m_memberDeptCombo = nullptr;
    QListWidget *m_membersList = nullptr;
    QLabel *m_selectedCountLabel = nullptr;
    QLabel *m_selectedMembersSummary = nullptr;
    QComboBox *m_statusCombo = nullptr;
    QDateEdit *m_startDateEdit = nullptr;
    QDateEdit *m_endDateEdit = nullptr;
    QTextEdit *m_tasksEdit = nullptr;

    QJsonArray m_allMembers;
    QMap<QString, QString> m_selectedMembers;
    QJsonObject m_existing;
    bool m_editMode = false;
    bool m_updatingMemberList = false;
};

#endif // PROJECTEDITDIALOG_H
