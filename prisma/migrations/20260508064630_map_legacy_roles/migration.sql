-- Map legacy role strings to new RBAC roles
-- Legacy roles observed: ADMIN | OPERATOR | ACCOUNTING | READONLY
-- New roles: administrator | operator | doar_vizualizare

UPDATE "User" SET "role" = 'administrator' WHERE "role" = 'ADMIN';
UPDATE "User" SET "role" = 'operator' WHERE "role" = 'OPERATOR';
UPDATE "User" SET "role" = 'doar_vizualizare' WHERE "role" IN ('ACCOUNTING', 'READONLY');

