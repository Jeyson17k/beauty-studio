// Las pruebas usan una base aparte (TEST_DATABASE_URL) que se borra y se vuelve a crear.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "postgres://beauty:beauty@localhost:5432/beautystudio_test";
process.env.WHATSAPP_MODE = "simulado";
process.env.WHATSAPP_SIM_AUTO = "off";
process.env.STORAGE_DIR = process.env.STORAGE_DIR_TEST || "./almacenamiento-pruebas";
process.env.SESSION_SECRET ||= "clave-de-pruebas-0123456789-0123456789";
