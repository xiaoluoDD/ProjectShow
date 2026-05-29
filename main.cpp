#include "applogger.h"
#include "appstyle.h"
#include "mainwindow.h"

#include <QApplication>

int main(int argc, char *argv[])
{
    QApplication app(argc, argv);
    QApplication::setApplicationName(QStringLiteral("ProjectKanban"));
    QApplication::setOrganizationName(QStringLiteral("TOYOTAProject"));

    AppStyle::apply(app);

    AppLogger::instance().init();

    MainWindow window;
    window.show();

    return app.exec();
}
