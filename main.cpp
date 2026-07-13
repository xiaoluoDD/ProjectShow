#include "applogger.h"
#include "appstyle.h"
#include "appversion.h"
#include "mainwindow.h"

#include <QApplication>

int main(int argc, char *argv[])
{
    QApplication app(argc, argv);
    QApplication::setApplicationName(QStringLiteral("ProjectKanban"));
    QApplication::setApplicationDisplayName(AppVersion::windowTitle());
    QApplication::setApplicationVersion(AppVersion::number());
    QApplication::setOrganizationName(QStringLiteral("TOYOTAProject"));

    AppStyle::apply(app);

    AppLogger::instance().init();

    MainWindow window;
    window.show();

    return app.exec();
}
