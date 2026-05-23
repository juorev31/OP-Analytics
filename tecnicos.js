// ============================================================
// tecnicos.js — Fuente única de datos de técnicos
// ============================================================
// Importar desde aquí en todos los módulos que necesiten
// información de técnicos (rendimiento.js, panel-principal.js,
// tickets.js, etc.)
// ============================================================

export const TECNICOS = {
    'julio.orozco@sonda.com': {
        nombre: 'Julio Cesar Orozco Evangelista',
        alias:  'JULIO A.VIP',
        tag:    'VIP',
        color:  '#f59e0b',
        meta:   10
    },
    'kevi.inga@sonda.com': {
        nombre: 'Inga Rojas, Kevin Anibal',
        alias:  'KEVIN A.INC',
        tag:    'INC',
        color:  '#4C8BF5',
        meta:   10
    },
    'yumich.cordero@sonda.com': {
        nombre: 'Cordero Eyzaguirre, Yumich',
        alias:  'YUMICH A.REQ',
        tag:    'REQ',
        color:  '#a855f7',
        meta:   10
    }
};

export const ADMIN_EMAIL = 'julio.orozco@sonda.com';

// Lista de aliases válidos (para filtros rápidos)
export const ALIASES_VALIDOS = Object.values(TECNICOS).map(t => t.alias);

// Mapa email → alias (para autocompletar en formularios)
export const EMAIL_A_ALIAS = Object.fromEntries(
    Object.entries(TECNICOS).map(([email, t]) => [email, t.alias])
);
