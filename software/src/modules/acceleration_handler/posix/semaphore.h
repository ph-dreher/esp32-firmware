#pragma once

#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

#ifdef __cplusplus
extern "C" {
#endif

// Semaphore handle
typedef SemaphoreHandle_t sem_t;

int sem_init(sem_t *sem, int pshared, unsigned int value);
void sem_destroy(sem_t *sem);
int sem_wait(sem_t *sem);
int sem_post(sem_t *sem);

#ifdef __cplusplus
}
#endif
