#include "semaphore.h"

#ifdef __cplusplus
extern "C" {
#endif

// Function to initialize semaphore
int sem_init(SemaphoreHandle_t *sem, int pshared, unsigned int value) {
    // FreeRTOS doesn't use the `pshared` parameter; ignore it.
    *sem = xSemaphoreCreateCounting(UINT_MAX, value);
    if (*sem == NULL) {
        return -1; // Failed to create semaphore
    }
    return 0; // Success
}

void sem_destroy(sem_t *sem) {
    if (sem != NULL && *sem != NULL) {
        vSemaphoreDelete(*sem);
        *sem = NULL; // Set to NULL to avoid dangling pointer
    }
}

int sem_wait(sem_t *sem) {
    if (sem == NULL || *sem == NULL) {
        return -1; // Invalid semaphore
    }

    // Block indefinitely until the semaphore is available
    if (xSemaphoreTake(*sem, portMAX_DELAY) == pdPASS) {
        return 0; // Success
    }
    return -1; // Failed to take semaphore
}

int sem_post(sem_t *sem) {
    if (sem == NULL || *sem == NULL) {
        return -1; // Invalid semaphore
    }

    if (xSemaphoreGive(*sem) == pdPASS) {
        return 0; // Success
    }
    return -1; // Failed to give semaphore
}

#ifdef __cplusplus
}
#endif
