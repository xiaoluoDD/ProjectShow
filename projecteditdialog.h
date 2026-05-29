#ifndef PROJECTEDITDIALOG_H
#define PROJECTEDITDIALOG_H

#include <QDialog>
#include <QJsonArray>
#include <QJsonObject>

class QComboBox;
class QLineEdit;
class QTextEdit;

class ProjectEditDialog : public QDialog
{
    Q_OBJECT

public:
    explicit ProjectEditDialog(const QJsonArray &members, const QJsonObject &existing,
                               QWidget *parent = nullptr);

    QJsonObject projectJson() const;
    bool isEditMode() const;

private:
    QLineEdit *m_yearEdit = nullptr;
    QLineEdit *m_workNoEdit = nullptr;
    QLineEdit *m_nameEdit = nullptr;
    QComboBox *m_managerCombo = nullptr;
    QComboBox *m_statusCombo = nullptr;
    QLineEdit *m_startDateEdit = nullptr;
    QLineEdit *m_endDateEdit = nullptr;
    QTextEdit *m_tasksEdit = nullptr;

    QJsonObject m_existing;
    bool m_editMode = false;
};

#endif // PROJECTEDITDIALOG_H
