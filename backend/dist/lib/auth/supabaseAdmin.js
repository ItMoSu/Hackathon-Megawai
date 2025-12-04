"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl) {
    throw new Error('SUPABASE_URL wajib ada di .env');
}
if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY wajib ada di .env untuk operasi admin');
}
exports.supabaseAdmin = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
