#ifndef LOGPANELWIDGET_H
#define LOGPANELWIDGET_H

#include "applogger.h"

#include <QWidget>

class QComboBox;
class QPlainTextEdit;
class QPushButton;

class LogPanelWidget : public QWidget
{
    Q_OBJECT

public:
    explicit LogPanelWidget(QWidget *parent = nullptr);

private slots:
    void onLogRecorded(const QString &line, AppLogger::Level level);
    void onClearClicked();
    void onOpenFolderClicked();
    void onLevelFilterChanged(int index);

private:
    void appendLine(const QString &line, AppLogger::Level level);
    bool passFilter(AppLogger::Level level) const;

    QPlainTextEdit *m_view = nullptr;
    QComboBox *m_levelFilter = nullptr;
    QPushButton *m_clearBtn = nullptr;
    QPushButton *m_openFolderBtn = nullptr;
    AppLogger::Level m_filterMin = AppLogger::Level::Debug;
};

#endif // LOGPANELWIDGET_H
