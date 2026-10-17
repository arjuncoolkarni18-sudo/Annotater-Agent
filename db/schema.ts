import {integer,sqliteTable,text} from 'drizzle-orm/sqlite-core';
export const handwritingProfiles=sqliteTable('handwriting_profiles',{
 ownerId:text('owner_id').primaryKey(),
 payload:text('payload').notNull(),
 revision:integer('revision').notNull().default(1),
 updatedAt:integer('updated_at').notNull(),
});
