#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QMainWindow>

class QLineEdit;
class QTabWidget;
class ProjectPanelWidget;
class DebugPanelWidget;
class LogPanelWidget;
class QNetworkAccessManager;

class MainWindow : public QMainWindow
{
    Q_OBJECT

public:
    explicit MainWindow(QWidget *parent = nullptr);
    ~MainWindow() override;

    QString serverBaseUrl() const;
    QNetworkAccessManager *networkManager() const;

private:
    void saveServerUrl() const;

    QLineEdit *m_serverEdit = nullptr;
    QTabWidget *m_tabs = nullptr;
    ProjectPanelWidget *m_projectPanel = nullptr;
    DebugPanelWidget *m_debugPanel = nullptr;
    LogPanelWidget *m_logPanel = nullptr;
    QNetworkAccessManager *m_net = nullptr;
};

#endif // MAINWINDOW_H
