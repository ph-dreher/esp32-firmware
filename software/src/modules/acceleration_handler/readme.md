# Hintergrund

Das `AccelerationHandler`-Modul verbindet sich mit der WIFI Master Extension 2.0, über die das Accelerometer Bricklet 2.0 erreichbar ist. Es scheint keinen Weg zu geben, mit der [C/C++-API für Mikrocontroller](https://www.tinkerforge.com/de/doc/Software/API_Bindings_uC.html#api-bindings-uc) Bricklets über das Netzwerk anzusprechen (sondern nur lokal verbundene, die über den Hardware Abstraction Layer erreichbar sind). Für eine Remote-Verbindung wird demnach die normale [C/C++-API](https://www.tinkerforge.com/de/doc/Software/API_Bindings_C.html#api-bindings-c) benötigt. Diese ist aber nicht wohne weiteres auf dem ESP32 Brick lauffähig.

## Probleme mit der C/C++-API auf dem ESP32 Brick

Zum Ansprechen des Accelerometer Bricklet 2.0 werden vier Dateien aus der C/C++-API benötigt: `bricklet_accelerometer_v2.c`, `bricklet_accelerometer_v2.h`, `ip_connection.c` und `ip_connection.h`. Uns sind zwei Probleme aufgefallen, die das Hineinkompilieren dieser Dateien verhindern:
- In der esp32-Umgebung existiert keine `semaphore.h`.
- Die `pthread_self()`-Implementierung im Espressif IoT Development Framework kann nur aus von mit pthreads erstellten Threads aufgerufen werden ([POSIX Support (Including POSIX Threads Support)](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/pthread.html)).

Um die Remote-Verbindung zum Accelerometer Bricklet 2.0 herzustellen, haben wir folgende Veränderungen vorgenommen:

- Wir haben eine eigene `semaphore.h` und `semaphore.c` implementiert, die die von der API benötigten Funktionen auf die entsprechenden Funktionen der FreeRTOS-Bibliothek abbildet. Diese Dateien befinden sich im Modulverzeichnis im Unterverzeichnis `posix`.

- Wir haben die `ip_connection.h` aus der C/C++-API abgeändert, um unsere `semaphore.h` einzubinden, anstatt im Include-Pfad danach zu suchen:

    ```diff
    --- "a/software/src/modules/acceleration_handler/tkapi/ip_connection.h"
    +++ "b/software/src/modules/acceleration_handler/tkapi/ip_connection.h"
    @@ -33,7 +33,7 @@
        #include <windows.h>
    #else
        #include <pthread.h>
    -	#include <semaphore.h>
    +	#include "../posix/semaphore.h"
    #endif
    
    #ifdef __cplusplus
    ```

- Wir haben die `ip_connection.c` aus der C/C++-API abgeändert, um statt `pthread_self()` die Funktion `xTaskGetCurrentTaskHandle()` aus der FreeRTOS-Bibliothek aufzurufen.

    ```diff
    --- "a/software/src/modules/acceleration_handler/tkapi/ip_connection.c"
    +++ "b/software/src/modules/acceleration_handler/tkapi/ip_connection.c"
    @@ -1012,7 +1012,7 @@ static void thread_destroy(Thread *thread) {
    }
    
    static bool thread_is_current(Thread *thread) {
    -	return pthread_equal(thread->handle, pthread_self()) ? true : false;
    +	return pthread_equal(thread->handle, (pthread_t)xTaskGetCurrentTaskHandle()) ? true : false;
    }
    
    static void thread_join(Thread *thread) {
    ```

# Installation

Das `AccelerationHandler`-Modul ist ein Plugin für die ESP32-Brick-Firmware. Um ein funktionierendes Projekt aufzusetzen, ist das Vorgehen daher wie folgt:

- Download und Aufsetzen der Firmware wie in [ESP32 Firmware](https://www.tinkerforge.com/de/doc/Software/ESP32_Firmware.html#esp32-firmware-setup) beschrieben.
- Bearbeiten der `software/platformio.ini`, um `default_envs = esp32` zu setzen.
- Bearbeiten der `software/esp32.ini`, um `Acceleration Handler` ans Ende der `custom_backend_modules`-Liste hinzuzufügen.
- Ablegen der Dateien des `AccelerationHandler`-Moduls unter `software/src/modules/acceleration_handler`.

Die benötigten und bereits bearbeiteten Dateien der C/C++-API sind im Modul-Quellcode bereits im Unterverzeichnis `tkapi` enthalten. Alternativ können die vier Dateien (`bricklet_accelerometer_v2.c`, `bricklet_accelerometer_v2.h`, `ip_connection.c` und `ip_connection.h`) direkt aus dem offiziellen [Download](https://www.tinkerforge.com/de/doc/Software/API_Bindings_C.html#api-bindings-c) entnommen und wie oben beschrieben abgeändert werden.

# Einrichtung

Am einfachsten wird der ESP32 Brick so konfiguriert, dass er einen Access Point mit den aufgedruckten Standard-Einstellungen aufsetzt und die WIFI Master Extension 2.0 im Stack des Bricklets so konfiguriert, dass sie sich im Client-Modus mit diesem Access Point verbindet.

Wenn das `AccelerationHandler`-Modul eine WLAN-Verbindung durch die WIFI Master Extension 2.0 feststellt, stellt es automatisch eine Verbindung zum dort verbundenen Bricklet her und beginnt, dessen Messwerte über das Industrial Analog Out Bricklet 2.0 auszugeben.

Wie genau die Abbildung von Beschleunigung auf Stromstärke funktioniert, ist in der Datei `acceleration_handler.h` durch die Konstanten `min_current_ma`, `max_current_ma`, `acceleration_scale_mg`, `data_rate` und `acceleration_axis` definiert.