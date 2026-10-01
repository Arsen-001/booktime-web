"use client";

/**
 * М1 обзора «Сотрудники»: карточка открывалась 1,4–2,4 с одной серой заглушкой на всю страницу, хотя имя, фото
 * и должность уже были в строке списка. Перед переходом кладём строку в кэш карточки — шапка и «Информация»
 * рисуются сразу; метка «устарело» (updatedAt: 0) заставляет карточку тихо сверить данные с «сервером» в фоне
 * (без скелетона — данные уже на экране).
 */
import { getQueryClient } from "@/api/request";
import { staffCardFromRow, type StaffListRow } from "@/api/staff";

export function seedStaffCard(row: StaffListRow, businessName: string): void {
  const client = getQueryClient();
  const key = ["staff", "card", row.staff.id];
  if (client.getQueryData(key) !== undefined) return;
  client.setQueryData(key, staffCardFromRow(row, businessName), { updatedAt: 0 });
}
