#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QMainWindow>

class QTabWidget;
class ProjectPanelWidget;
class MemberPanelWidget;
class DepartmentPanelWidget;
class DebugHubWidget;
class QNetworkAccessManager;

class MainWindow : public QMainWindow
{
    Q_OBJECT

public:
    explicit MainWindow(QWidget *parent = nullptr);
    ~MainWindow() override;

    QString serverBaseUrl() const;
    QNetworkAccessManager *networkManager() const;

    QString selectedMemberUserId() const;
    QString selectedMemberName() const;
    QString selectedMemberDisplay() const;

public slots:
    void setSelectedMember(const QString &userid, const QString &name);
    void setServerBaseUrl(const QString &url);
    void loadServerUrlFromBackend();

signals:
    void memberSelectionChanged(const QString &userid, const QString &name);
    void serverBaseUrlChanged(const QString &url);

private:
    QTabWidget *m_tabs = nullptr;
    ProjectPanelWidget *m_projectPanel = nullptr;
    MemberPanelWidget *m_memberPanel = nullptr;
    DepartmentPanelWidget *m_departmentPanel = nullptr;
    DebugHubWidget *m_debugHub = nullptr;
    QNetworkAccessManager *m_net = nullptr;
    QString m_serverBaseUrl;
    QString m_selectedUserId;
    QString m_selectedMemberName;
};

#endif // MAINWINDOW_H
