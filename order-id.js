(function (global) {
  'use strict';

  const TIME_ZONE = 'America/Lima';
  const TIME_OFFSET = '-05:00';
  const AMOUNT_KEY = 0xA5A5;
  const AMOUNT_DIGITS = 8;
  const CUSTOMER_DIGITS = 8;
  const ID_LENGTH = AMOUNT_DIGITS + CUSTOMER_DIGITS;
  const HASH_MOD = 100000000n;
  const MAX_CENTS = 99999999;

  const limaFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  function pad(value, digits) {
    return String(value).padStart(digits, '0');
  }

  function normalizeName(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizePhone(value) {
    return String(value == null ? '' : value).replace(/\D/g, '');
  }

  function toCents(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 100) : NaN;
  }

  function limaParts(date) {
    const parts = {};
    limaFormatter.formatToParts(date).forEach(function (part) {
      parts[part.type] = part.value;
    });
    if (parts.hour === '24') parts.hour = '00';
    return parts;
  }

  function canonicalDateTime(dateInput) {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (!date || Number.isNaN(date.getTime())) return null;
    const parts = limaParts(date);
    return parts.year + '-' + parts.month + '-' + parts.day +
      'T' + parts.hour + ':' + parts.minute + ':' + parts.second;
  }

  function displayDateTime(dateInput) {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (!date || Number.isNaN(date.getTime())) return '';
    const parts = limaParts(date);
    return parts.day + '/' + parts.month + '/' + parts.year +
      ' ' + parts.hour + ':' + parts.minute + ':' + parts.second;
  }

  function canonicalFromInputs(dateValue, timeValue) {
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || '').trim());
    const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(timeValue || '').trim());
    if (!dateMatch || !timeMatch) return null;

    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    const second = Number(timeMatch[3] || '00');

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    if (hour > 23 || minute > 59 || second > 59) return null;

    const probe = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    if (
      probe.getUTCFullYear() !== year ||
      probe.getUTCMonth() !== month - 1 ||
      probe.getUTCDate() !== day ||
      probe.getUTCHours() !== hour ||
      probe.getUTCMinutes() !== minute ||
      probe.getUTCSeconds() !== second
    ) {
      return null;
    }

    return year + '-' + dateMatch[2] + '-' + dateMatch[3] +
      'T' + timeMatch[1] + ':' + timeMatch[2] + ':' + pad(second, 2);
  }

  function amountToken(cents) {
    const number = Number(cents);
    if (!Number.isInteger(number) || number < 0 || number > MAX_CENTS) return null;
    const token = String((number ^ AMOUNT_KEY) >>> 0);
    if (token.length > AMOUNT_DIGITS) return null;
    return pad(token, AMOUNT_DIGITS);
  }

  function decodeAmountToken(token) {
    const digits = String(token == null ? '' : token).replace(/\D/g, '');
    if (digits.length !== AMOUNT_DIGITS) return null;
    const value = (parseInt(digits, 10) ^ AMOUNT_KEY) >>> 0;
    return Number.isInteger(value) ? value : null;
  }

  function fnv1a64(value) {
    const text = String(value);
    let hash = 0xcbf29ce484222325n;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= BigInt(text.charCodeAt(index));
      hash = BigInt.asUintN(64, hash * 0x100000001b3n);
    }
    return hash;
  }

  function hashInput(name, phone, canonical, cents) {
    return name + '|' + phone + '|' + canonical + TIME_OFFSET + '|' + cents;
  }

  function customerToken(data) {
    const name = normalizeName(data.nombre);
    const phone = normalizePhone(data.telefono);
    const text = hashInput(name, phone, data.canonical, data.cents);
    return pad(fnv1a64(text) % HASH_MOD, CUSTOMER_DIGITS);
  }

  function build(data) {
    const name = normalizeName(data.nombre);
    const phone = normalizePhone(data.telefono);
    const cents = Number.isInteger(data.cents) ? data.cents : toCents(data.monto);
    const canonical = data.canonical || canonicalDateTime(data.fecha || new Date());

    if (name.length < 3) {
      return { ok: false, error: 'Escribe el nombre completo del cliente.' };
    }
    if (phone.length < 6 || phone.length > 20) {
      return { ok: false, error: 'Ingresa un teléfono válido del cliente.' };
    }
    if (!Number.isInteger(cents) || cents <= 0 || cents > MAX_CENTS) {
      return { ok: false, error: 'El monto debe estar entre S/ 0.01 y S/ 999,999.99.' };
    }
    if (!canonical) {
      return { ok: false, error: 'Ingresa una fecha y hora válidas.' };
    }

    const amount = amountToken(cents);
    if (!amount) {
      return { ok: false, error: 'No se pudo ofuscar el importe del pedido.' };
    }

    const customer = customerToken({
      nombre: name,
      telefono: phone,
      canonical: canonical,
      cents: cents
    });

    return {
      ok: true,
      id: amount + customer,
      amountToken: amount,
      customerToken: customer,
      cents: cents,
      canonical: canonical,
      display: displayDateTime(new Date(canonical + TIME_OFFSET))
    };
  }

  function isValidId(value) {
    return new RegExp('^\\d{' + ID_LENGTH + '}$').test(String(value == null ? '' : value).replace(/\s+/g, ''));
  }

  function decodeAmount(value) {
    const digits = String(value == null ? '' : value).replace(/\D/g, '');
    if (digits.length !== ID_LENGTH) return null;
    return decodeAmountToken(digits.slice(0, AMOUNT_DIGITS));
  }

  global.MalakoOrderId = {
    TIME_ZONE: TIME_ZONE,
    TIME_OFFSET: TIME_OFFSET,
    AMOUNT_DIGITS: AMOUNT_DIGITS,
    CUSTOMER_DIGITS: CUSTOMER_DIGITS,
    ID_LENGTH: ID_LENGTH,
    MAX_CENTS: MAX_CENTS,
    normalizeName: normalizeName,
    normalizePhone: normalizePhone,
    toCents: toCents,
    canonicalDateTime: canonicalDateTime,
    displayDateTime: displayDateTime,
    canonicalFromInputs: canonicalFromInputs,
    amountToken: amountToken,
    decodeAmountToken: decodeAmountToken,
    customerToken: customerToken,
    build: build,
    isValidId: isValidId,
    decodeAmount: decodeAmount
  };
})(window);
