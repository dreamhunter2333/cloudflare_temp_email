import type { Context } from 'hono';
import { CONSTANTS } from '../constants';
import { AddressCreationSettings } from '../models';
import { getBooleanValue, getIntValue, getJsonSetting, getRandomSubdomainDomains, getStringValue, trimLower as normalizeDomainValue } from '../utils';

const DEFAULT_NAME_REGEX = /[^a-z0-9]/g;
const DEFAULT_RANDOM_SUBDOMAIN_LENGTH = 8;
const MAX_DOMAIN_LENGTH = 253;
const DOMAIN_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

const isValidDomainLabel = (label: string): boolean => {
    return DOMAIN_LABEL_RE.test(label);
}

const areValidDomainLabels = (labels: string[]): boolean => {
    return labels.length > 0 && labels.every((label) => isValidDomainLabel(label));
}

export const generateRandomName = (c: Context<HonoCustomType>): string => {
    // name min length min 1
    const minLength = Math.max(
        getIntValue(c.env.MIN_ADDRESS_LEN, 1),
        1
    );
    // name max length min 1
    const maxLength = Math.max(
        getIntValue(c.env.MAX_ADDRESS_LEN, 30),
        1
    );

    // Build full name recursively until minimum length is reached
    const buildName = (currentName: string = ""): string => {
        return currentName.length >= minLength
            ? currentName
            : buildName(currentName + Math.random().toString(36).substring(2, 15));
    };

    const fullName = buildName();

    // Return truncated to max length
    return fullName.substring(0, Math.min(fullName.length, maxLength));
};

export const generateRandomSubdomain = (c: Context<HonoCustomType>): string => {
    const charset = "abcdefghijklmnopqrstuvwxyz0123456789";
    const length = Math.min(
        Math.max(getIntValue(c.env.RANDOM_SUBDOMAIN_LENGTH, DEFAULT_RANDOM_SUBDOMAIN_LENGTH), 1),
        63
    );
    let subdomain = "";
    for (let i = 0; i < length; i++) {
        subdomain += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return subdomain;
}

export const allowRandomSubdomainForDomain = (
    c: Context<HonoCustomType>,
    domain: string
): boolean => {
    const normalizedDomain = normalizeDomainValue(domain);
    return getRandomSubdomainDomains(c)
        .map((item) => normalizeDomainValue(item))
        .includes(normalizedDomain);
}

const isCreateAddressSubdomainMatchEnvConfigured = (c: Context<HonoCustomType>): boolean => {
    return c.env.ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH !== undefined
        && c.env.ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH !== null
        && c.env.ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH !== "";
}

export const getAddressCreationSettings = async (
    c: Context<HonoCustomType>
): Promise<AddressCreationSettings> => {
    const value = await getJsonSetting<AddressCreationSettings>(
        c, CONSTANTS.ADDRESS_CREATION_SETTINGS_KEY
    );
    return new AddressCreationSettings(value);
}

export const getAddressCreationSubdomainMatchStatus = async (
    c: Context<HonoCustomType>,
    existingSettings?: AddressCreationSettings
): Promise<{
    envConfigured: boolean,
    envEnabled: boolean,
    storedEnabled: boolean | undefined,
    effectiveEnabled: boolean,
}> => {
    const envConfigured = isCreateAddressSubdomainMatchEnvConfigured(c);
    const envEnabled = getBooleanValue(c.env.ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH);
    const addressCreationSettings = existingSettings || await getAddressCreationSettings(c);
    const storedEnabled = addressCreationSettings.enableSubdomainMatch;

    // 业务约束：env=false 作为全局 kill switch，后台开关不能强行打开。
    const effectiveEnabled = envConfigured && !envEnabled
        ? false
        : typeof storedEnabled === "boolean"
            ? storedEnabled
            : envEnabled;

    return {
        envConfigured,
        envEnabled,
        storedEnabled,
        effectiveEnabled,
    };
}

export const findMatchedAllowedDomain = (
    domain: string,
    allowDomains: string[],
    enableSubdomainMatch: boolean,
): string | null => {
    const normalizedDomain = normalizeDomainValue(domain);
    if (normalizedDomain.length > MAX_DOMAIN_LENGTH) {
        return null;
    }
    const domainLabels = normalizedDomain.split('.');
    if (!areValidDomainLabels(domainLabels)) {
        return null;
    }
    const normalizedAllowDomains = allowDomains.map((allowDomain) => normalizeDomainValue(allowDomain));
    if (normalizedAllowDomains.includes(normalizedDomain)) {
        return normalizedDomain;
    }
    if (!enableSubdomainMatch) {
        return null;
    }
    const matchedDomain = [...normalizedAllowDomains]
        .sort((a, b) => b.length - a.length)
        .find((allowDomain) => {
            if (allowDomain.length > MAX_DOMAIN_LENGTH) {
                return false;
            }
            const allowDomainLabels = allowDomain.split('.');
            if (!areValidDomainLabels(allowDomainLabels)) {
                return false;
            }
            if (domainLabels.length <= allowDomainLabels.length) {
                return false;
            }
            const prefixLabels = domainLabels.slice(0, domainLabels.length - allowDomainLabels.length);
            if (!areValidDomainLabels(prefixLabels)) {
                return false;
            }
            return allowDomainLabels.every((label, index) => {
                return domainLabels[domainLabels.length - allowDomainLabels.length + index] === label;
            });
        });
    return matchedDomain || null;
}

export const checkNameRegex = (c: Context<HonoCustomType>, name: string) => {
    let error = null;
    try {
        const regexStr = getStringValue(c.env.ADDRESS_CHECK_REGEX);
        if (!regexStr) return;
        const regex = new RegExp(regexStr);
        if (!regex.test(name)) {
            error = new Error(`Name not match regex: /${regexStr}/`);
        }
    }
    catch (e) {
        console.error("Failed to check address regex", e);
    }
    if (error) {
        throw error;
    }
}

export const getNameRegex = (c: Context<HonoCustomType>): RegExp => {
    try {
        const regex = getStringValue(c.env.ADDRESS_REGEX);
        if (!regex) {
            return DEFAULT_NAME_REGEX;
        }
        return new RegExp(regex, 'g');
    }
    catch (e) {
        console.error("Failed to get address regex", e);
    }
    return DEFAULT_NAME_REGEX;
}

export const checkNameBlockList = async (
    c: Context<HonoCustomType>, name: string
): Promise<void> => {
    // check name block list
    const blockList = [] as string[];
    try {
        const value = await getJsonSetting(c, CONSTANTS.ADDRESS_BLOCK_LIST_KEY);
        blockList.push(...(value || []));
    } catch (error) {
        console.error(error);
    }
    if (blockList.some((item) => name.includes(item))) {
        throw new Error(`Name[${name}]is blocked`);
    }
}
