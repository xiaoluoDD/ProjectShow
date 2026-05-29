#ifndef PROJECTPANELWIDGET_H
#define PROJECTPANELWIDGET_H

#include <QWidget>
#include <QJsonArray>
#include <QJsonObject>

class MainWindow;
class QLabel;
class QPushButton;
class QTableWidget;
class QNetworkReply;

namespace ProjectPanelRequests {
enum class Kind {
    LoadProjects,
    LoadMembers,
    CreateProject,
    UpdateProject,
    DeleteProject,
    SendNotify,
};
enum class PendingAction { None, OpenAddDialog, OpenEditDialog };
}

class ProjectPanelWidget : public QWidget
{
    Q_OBJECT

public:
    explicit ProjectPanelWidget(QWidget *parent = nullptr);

private slots:
    void onRefreshClicked();
    void onAddClicked();
    void onEditClicked();
    void onDeleteClicked();
    void onSendNotifyClicked();
    void onMemberSelectionChanged(const QString &userid, const QString &name);
    void onReplyFinished(QNetworkReply *reply);

private:
    MainWindow *mainWindow() const;
    bool checkServerUrl(QString *baseOut = nullptr);
    void startGet(const QString &path, ProjectPanelRequests::Kind kind);
    void startPost(const QString &path, ProjectPanelRequests::Kind kind, const QByteArray &body);
    void startPut(const QString &path, ProjectPanelRequests::Kind kind, const QByteArray &body);
    void startDelete(int projectId);
    void setBusy(bool busy);
    void updateNotifyTargetLabel();
    void setupProjectTable();
    void adjustProjectTableColumns();
    void fillProjects(const QJsonArray &projects);
    QJsonObject selectedProject() const;
    void loadMembersForDialog(ProjectPanelRequests::PendingAction action,
                              const QJsonObject &editExisting = QJsonObject());
    void showProjectDialog(const QJsonObject &existing);

    QLabel *m_statusLabel = nullptr;
    QLabel *m_notifyTargetLabel = nullptr;
    QTableWidget *m_projectTable = nullptr;
    QPushButton *m_refreshBtn = nullptr;
    QPushButton *m_addBtn = nullptr;
    QPushButton *m_editBtn = nullptr;
    QPushButton *m_delBtn = nullptr;
    QPushButton *m_sendBtn = nullptr;
    QJsonArray m_members;
    ProjectPanelRequests::PendingAction m_pendingAction = ProjectPanelRequests::PendingAction::None;
    QJsonObject m_pendingEditProject;
};

#endif // PROJECTPANELWIDGET_H
