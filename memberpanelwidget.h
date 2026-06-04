#ifndef MEMBERPANELWIDGET_H
#define MEMBERPANELWIDGET_H

#include <QWidget>
#include <QJsonArray>
#include <QJsonObject>

class MainWindow;
class QLabel;
class QPushButton;
class QTableWidget;
class QNetworkReply;

namespace MemberPanelRequests {
enum class Kind { Sync, LoadUsers, LoadDepartments, UpdateUser };
enum class PendingAction { None, OpenEditDialog };
}

class MemberPanelWidget : public QWidget
{
    Q_OBJECT

public:
    explicit MemberPanelWidget(QWidget *parent = nullptr);

private slots:
    void onSyncClicked();
    void onRefreshClicked();
    void onSelectionChanged();
    void onMemberDoubleClicked(int row, int column);
    void onReplyFinished(QNetworkReply *reply);

private:
    MainWindow *mainWindow() const;
    bool checkServerUrl(QString *baseOut = nullptr);
    void startGet(const QString &path, MemberPanelRequests::Kind kind);
    void startPost(const QString &path, MemberPanelRequests::Kind kind, const QByteArray &body = QByteArray("{}"));
    void startPut(const QString &path, MemberPanelRequests::Kind kind, const QByteArray &body);
    void setBusy(bool busy);
    void showMembers(const QJsonArray &users);
    QJsonObject selectedUser() const;
    void applyRowSelection(int row);
    void loadDepartmentsForDialog(const QJsonObject &editUser);
    void showMemberDialog(const QJsonObject &user);
    static QString formatDepartmentText(const QJsonObject &user);

    QLabel *m_hintLabel = nullptr;
    QLabel *m_countLabel = nullptr;
    QTableWidget *m_table = nullptr;
    QPushButton *m_syncBtn = nullptr;
    QPushButton *m_refreshBtn = nullptr;
    QJsonArray m_departments;
    QJsonArray m_users;
    MemberPanelRequests::PendingAction m_pendingAction = MemberPanelRequests::PendingAction::None;
    QJsonObject m_pendingEditUser;
};

#endif // MEMBERPANELWIDGET_H
