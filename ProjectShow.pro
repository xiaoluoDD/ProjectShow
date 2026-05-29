QT       += core gui widgets network

CONFIG   += c++17 warn_on depend_includepath

# MinGW 须启用 C++17，否则 Qt 头文件中 template<> inline 会报 “declared as an inline field”
win32-g++: QMAKE_CXXFLAGS += -std=gnu++17
TEMPLATE = app
TARGET   = ProjectKanban

SOURCES += \
    main.cpp \
    mainwindow.cpp \
    projectpanelwidget.cpp \
    projecteditdialog.cpp \
    memberpanelwidget.cpp \
    debugpanelwidget.cpp \
    debughubwidget.cpp \
    logpanelwidget.cpp \
    datapanelwidget.cpp \
    localdatastore.cpp \
    applogger.cpp \
    appstyle.cpp

HEADERS += \
    mainwindow.h \
    projectpanelwidget.h \
    projecteditdialog.h \
    memberpanelwidget.h \
    debugpanelwidget.h \
    debughubwidget.h \
    logpanelwidget.h \
    datapanelwidget.h \
    localdatastore.h \
    applogger.h \
    appstyle.h

# Qt 6.7.3，MSVC / MinGW 下保证源文件 UTF-8
msvc: QMAKE_CXXFLAGS += /utf-8

DEFINES += QT_DEPRECATED_WARNINGS
