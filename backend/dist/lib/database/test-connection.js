"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const queries_1 = require("./queries");
(async () => {
    try {
        await (0, queries_1.testDbConnection)();
        console.log('DB connection ok');
    }
    catch (error) {
        console.error('DB connection failed', error);
        process.exitCode = 1;
    }
})();
