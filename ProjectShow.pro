QT       += core gui widgets network

CONFIG   += c++17 warn_on depend_includepath

# MinGW 须启用 C++17，否则 Qt 头文件中 template<> inline 会报 “declared as an inline field”
win32-g++: QMAKE_CXXFLAGS += -std=gnu++17
TEMPLATE = app
TARGET   = ProjectKanban
VERSION  = 1.2.1

INCLUDEPATH += \
    $$PWD/app \
    $$PWD/dashboard \
    $$PWD/project \
    $$PWD/member \
    $$PWD/department \
    $$PWD/debug \
    $$PWD/core

SOURCES += \
    main.cpp \
    app/mainwindow.cpp \
    dashboard/dashboardpanelwidget.cpp \
    dashboard/dashboardpersontasksdialog.cpp \
    dashboard/dashboardpiechartwidget.cpp \
    dashboard/dashboardstats.cpp \
    project/projectpanelwidget.cpp \
    project/projecteditdialog.cpp \
    project/projectdetaildialog.cpp \
    project/projectsubtaskdialog.cpp \
    project/subtaskeditdialog.cpp \
    project/subtaskmemberspickerdialog.cpp \
    member/memberpanelwidget.cpp \
    member/membereditdialog.cpp \
    department/departmentpanelwidget.cpp \
    debug/debugpanelwidget.cpp \
    debug/debughubwidget.cpp \
    debug/logpanelwidget.cpp \
    debug/changelogdialog.cpp \
    debug/settingspanelwidget.cpp \
    debug/datapanelwidget.cpp \
    core/localdatastore.cpp \
    core/applogger.cpp \
    core/appstyle.cpp \
    core/appchangelog.cpp \
    core/datepickerutils.cpp \
    core/projectstatusutils.cpp \
    core/tableheaderfilter.cpp \
    core/debugaccess.cpp

HEADERS += \
    app/mainwindow.h \
    dashboard/dashboardpanelwidget.h \
    dashboard/dashboardpersontasksdialog.h \
    dashboard/dashboardpiechartwidget.h \
    dashboard/dashboardstats.h \
    project/projectpanelwidget.h \
    project/projecteditdialog.h \
    project/projectdetaildialog.h \
    project/projectsubtaskdialog.h \
    project/subtaskeditdialog.h \
    project/subtaskmemberspickerdialog.h \
    member/memberpanelwidget.h \
    member/membereditdialog.h \
    department/departmentpanelwidget.h \
    debug/debugpanelwidget.h \
    debug/debughubwidget.h \
    debug/logpanelwidget.h \
    debug/changelogdialog.h \
    debug/settingspanelwidget.h \
    debug/datapanelwidget.h \
    core/localdatastore.h \
    core/applogger.h \
    core/appstyle.h \
    core/appchangelog.h \
    core/datepickerutils.h \
    core/projectstatusutils.h \
    core/tableheaderfilter.h \
    core/debugaccess.h \
    core/appversion.h

# Qt 6.7.3，MSVC / MinGW 下保证源文件 UTF-8
msvc: QMAKE_CXXFLAGS += /utf-8

DEFINES += QT_DEPRECATED_WARNINGS
