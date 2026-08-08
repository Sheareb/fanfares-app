import { router, useLocalSearchParams } from "expo-router";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { hasSupabaseConfig, supabase } from "../lib/supabase";

type ReportRow = {
  customer_name: string | null;
  paid: boolean | null;
  boarded: boolean | null;
  pickup_description: string | null;
  pickup_time: string | null;
  trip_description: string | null;
  departure_date: string | null;
  departure_time: string | null;
  total_cost: number | null;
  seat_count: number | null;
  seat_price: number | null;
  trip_seat_price: number | null;
};

type TripInfo = {
  description: string | null;
  departure_date: string | null;
  departure_time: string | null;
  total_cost: number | null;
  seat_count: number | null;
  seat_price: number | null;
};

type GroupedPassengers = {
  pickupDescription: string;
  pickupTime: string;
  passengers: Array<{
    customerName: string;
    isPaid: boolean;
    isBoarded: boolean;
  }>;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseTimeForSort(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) {
    return Number.POSITIVE_INFINITY;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

function normalizeTime(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) {
    return trimmed || "Time not set";
  }

  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDeparture(date: string | null, time: string | null) {
  if (!date) {
    return "Unknown";
  }

  const normalizedTime = (time || "00:00").length === 5 ? `${time}:00` : time;
  const composed = `${date}T${normalizedTime || "00:00:00"}`;
  const parsed = new Date(composed);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatCurrency(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(value);
}

async function getWhiteLogoSrc() {
  const asset = Asset.fromModule(
    require("../assets/images/fanfares_logo_white.png"),
  );

  try {
    await asset.downloadAsync();
  } catch {
    return asset.uri;
  }

  if (!asset.localUri) {
    return asset.uri;
  }

  try {
    const base64 = await FileSystem.readAsStringAsync(asset.localUri, {
      encoding: "base64" as any,
    });
    return `data:image/png;base64,${base64}`;
  } catch {
    return asset.localUri;
  }
}

function buildGroups(rows: ReportRow[]) {
  const groups = new Map<string, GroupedPassengers>();

  for (const row of rows) {
    const pickupDescription = row.pickup_description || "Pickup not assigned";
    const pickupTime = row.pickup_time || "";
    const key = `${pickupTime}__${pickupDescription}`;
    if (!groups.has(key)) {
      groups.set(key, {
        pickupDescription,
        pickupTime,
        passengers: [],
      });
    }

    groups.get(key)?.passengers.push({
      customerName: row.customer_name || "Unknown",
      isPaid: Boolean(row.paid),
      isBoarded: Boolean(row.boarded),
    });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      passengers: [...group.passengers].sort((a, b) =>
        a.customerName.localeCompare(b.customerName),
      ),
    }))
    .sort((a, b) => {
      const timeDiff =
        parseTimeForSort(a.pickupTime) - parseTimeForSort(b.pickupTime);
      if (timeDiff !== 0) {
        return timeDiff;
      }

      return a.pickupDescription.localeCompare(b.pickupDescription);
    });
}

function buildReportHtml(params: {
  tripDescription: string;
  departureLabel: string;
  totalCostLabel: string;
  seatCountLabel: string;
  seatsBookedLabel: string;
  seatPriceLabel: string;
  totalReceivedLabel: string;
  outstandingLabel: string;
  travellerCount: number;
  paidCount: number;
  groups: GroupedPassengers[];
  logoSrc: string;
  generatedAtLabel: string;
}) {
  const {
    tripDescription,
    departureLabel,
    totalCostLabel,
    seatCountLabel,
    seatsBookedLabel,
    seatPriceLabel,
    totalReceivedLabel,
    outstandingLabel,
    travellerCount,
    paidCount,
    groups,
    logoSrc,
    generatedAtLabel,
  } = params;

  const groupSections =
    groups.length === 0
      ? '<p class="empty">No travellers booked for this trip.</p>'
      : groups
          .map((group) => {
            const passengers = group.passengers
              .map(
                (passenger) =>
                  `<tr><td>${escapeHtml(passenger.customerName)}${
                    passenger.isBoarded ? " (Boarded)" : ""
                  }</td><td class="paid-cell">${passenger.isPaid ? "✓" : ""}</td></tr>`,
              )
              .join("");

            return `
              <section class="pickup-group">
                <h3>${escapeHtml(normalizeTime(group.pickupTime))} - ${escapeHtml(
                  group.pickupDescription,
                )} (${group.passengers.length} passenger${
                  group.passengers.length === 1 ? "" : "s"
                })</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${passengers}
                  </tbody>
                </table>
              </section>
            `;
          })
          .join("");

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: #1f2937;
            background: #eef3fb;
            margin: 0;
            padding: 24px;
          }
          .page {
            background: #ffffff;
            border-radius: 18px;
            overflow: hidden;
            border: 1px solid #dbe4f0;
          }
          .content {
            padding: 40px 30px 34px;
          }
          .report-top {
            display: block;
            margin-bottom: 24px;
          }
          .logo-top {
            display: flex;
            justify-content: center;
            margin: 0 0 34px;
          }
          .logo-badge {
            background: #0f172a;
            border-radius: 12px;
            padding: 10px 14px;
            min-width: 122px;
            display: inline-flex;
            justify-content: center;
          }
          .logo-badge img {
            height: 10.5px;
            width: auto;
            display: block;
          }
          h1 {
            margin: 0 0 8px;
            font-size: 25px;
            color: #0f172a;
            letter-spacing: -0.01em;
          }
          .title-wrap {
            margin-top: 6px;
            margin-bottom: 14px;
          }
          .meta {
            margin: 0;
            color: #334155;
            line-height: 1.6;
            font-size: 14px;
          }
          .summary-box {
            margin: 0 0 28px;
            border: 1px solid #dbe4f0;
            border-radius: 14px;
            overflow: hidden;
          }
          .summary-box-title {
            margin: 0;
            padding: 11px 14px;
            font-size: 12px;
            font-weight: 700;
            color: #1e293b;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
          }
          .summary-box-grid {
            width: 100%;
            border-collapse: collapse;
          }
          .summary-box-grid td {
            border: 0;
            padding: 9px 14px;
            font-size: 14px;
            border-bottom: 1px solid #f1f5f9;
          }
          .summary-box-grid tr:last-child td {
            border-bottom: 0;
          }
          .summary-box-label {
            color: #64748b;
            width: 25%;
          }
          .summary-box-value {
            color: #0f172a;
            font-weight: 700;
            text-align: right;
          }
          .pickup-group {
            margin-bottom: 32px;
            break-inside: avoid;
            border: 1px solid #dbe4f0;
            border-radius: 14px;
            overflow: hidden;
            background: #fff;
          }
          .pickup-group + .pickup-group {
            margin-top: 24px;
          }
          .pickup-group h3 {
            margin: 0;
            padding: 11px 14px;
            font-size: 15px;
            color: #0f172a;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            border: 0;
          }
          th, td {
            padding: 10px 14px;
            border-bottom: 1px solid #e2e8f0;
            text-align: left;
            font-size: 13px;
          }
          th:last-child,
          td.paid-cell {
            text-align: center;
            width: 76px;
          }
          td.paid-cell {
            font-size: 16px;
            font-weight: 700;
            color: #047857;
          }
          tbody tr:last-child td {
            border-bottom: 0;
          }
          th {
            background: #f8fafc;
            color: #334155;
            font-weight: 700;
          }
          .empty {
            font-size: 14px;
            color: #6b7280;
            padding: 14px;
            border: 1px solid #dbe4f0;
            border-radius: 12px;
            background: #fff;
          }
          .footer {
            position: fixed;
            left: 30px;
            right: 30px;
            bottom: 10px;
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="content">
            <div class="report-top">
              <div class="logo-top">
                <div class="logo-badge">
                  <img src="${logoSrc}" alt="Fanfares" />
                </div>
              </div>
              <div class="title-wrap">
                <h1>${escapeHtml(`${tripDescription} - Trip Summary`)}</h1>
                <p class="meta">
                  <strong>Departure:</strong> ${escapeHtml(departureLabel)}<br />
                  <strong>Total Cost:</strong> ${escapeHtml(totalCostLabel)}<br />
                  <strong>Seat Count:</strong> ${escapeHtml(seatCountLabel)}<br />
                  <strong>Seat Price:</strong> ${escapeHtml(seatPriceLabel)}
                </p>
              </div>
            </div>

            <div class="summary-box">
              <p class="summary-box-title">Trip Summary Totals</p>
              <table class="summary-box-grid">
                <tr>
                  <td class="summary-box-label">Seats Booked</td>
                  <td class="summary-box-value">${escapeHtml(seatsBookedLabel)}</td>
                </tr>
                <tr>
                  <td class="summary-box-label">Total Received</td>
                  <td class="summary-box-value">${escapeHtml(totalReceivedLabel)}</td>
                  <td class="summary-box-label">Amount Outstanding</td>
                  <td class="summary-box-value">${escapeHtml(outstandingLabel)}</td>
                </tr>
              </table>
            </div>

            ${groupSections}
          </div>
        </div>
        <div class="footer">
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
          <span>${escapeHtml(generatedAtLabel)}</span>
        </div>
      </body>
    </html>
  `;
}

async function getLogoBytes(source: string) {
  if (source.startsWith("data:image")) {
    const [, base64] = source.split(",");
    const decoded = globalThis.atob(base64 || "");
    const bytes = new Uint8Array(decoded.length);

    for (let i = 0; i < decoded.length; i += 1) {
      bytes[i] = decoded.charCodeAt(i);
    }

    return bytes;
  }

  const response = await fetch(source);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

async function generateWebPdfPreview(params: {
  tripDescription: string;
  departureLabel: string;
  totalCostLabel: string;
  seatCountLabel: string;
  seatsBookedLabel: string;
  seatPriceLabel: string;
  totalReceivedLabel: string;
  outstandingLabel: string;
  travellerCount: number;
  paidCount: number;
  groups: GroupedPassengers[];
  logoSrc: string;
  generatedAtLabel: string;
}) {
  const {
    tripDescription,
    departureLabel,
    totalCostLabel,
    seatCountLabel,
    seatsBookedLabel,
    seatPriceLabel,
    totalReceivedLabel,
    outstandingLabel,
    travellerCount,
    paidCount,
    groups,
    logoSrc,
    generatedAtLabel,
  } = params;

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];

  let page = pdfDoc.addPage(pageSize);
  let y = page.getHeight() - 36;
  const margin = 34;
  const addNewPage = () => {
    page = pdfDoc.addPage(pageSize);
    y = page.getHeight() - margin;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      addNewPage();
    }
  };

  const drawLine = (
    text: string,
    options?: { bold?: boolean; size?: number },
  ) => {
    const size = options?.size ?? 11;
    ensureSpace(size + 6);
    page.drawText(text, {
      x: margin,
      y,
      size,
      font: options?.bold ? fontBold : fontRegular,
      color: rgb(0.13, 0.16, 0.21),
    });
    y -= size + 5;
  };

  const drawGroupTable = (group: GroupedPassengers) => {
    const tableWidth = page.getWidth() - margin * 2;
    const firstColWidth = tableWidth * 0.78;
    const secondColWidth = tableWidth - firstColWidth;
    const rowHeight = 20;
    const headerHeight = 22;

    const rows = group.passengers.map((passenger) => ({
      name: `${passenger.customerName || "Unknown"}${
        passenger.isBoarded ? " (Boarded)" : ""
      }`,
      paid: passenger.isPaid,
    }));

    const tableHeight = headerHeight + rows.length * rowHeight;
    ensureSpace(tableHeight + 10);

    const tableTopY = y;
    const tableBottomY = tableTopY - tableHeight;

    page.drawRectangle({
      x: margin,
      y: tableBottomY,
      width: tableWidth,
      height: tableHeight,
      borderColor: rgb(0.86, 0.89, 0.94),
      borderWidth: 1,
      color: rgb(1, 1, 1),
    });

    page.drawRectangle({
      x: margin,
      y: tableTopY - headerHeight,
      width: tableWidth,
      height: headerHeight,
      color: rgb(0.97, 0.98, 0.99),
    });

    page.drawLine({
      start: { x: margin + firstColWidth, y: tableBottomY },
      end: { x: margin + firstColWidth, y: tableTopY },
      thickness: 1,
      color: rgb(0.89, 0.91, 0.94),
    });

    page.drawText("Name", {
      x: margin + 10,
      y: tableTopY - 15,
      size: 10,
      font: fontBold,
      color: rgb(0.2, 0.25, 0.33),
    });

    page.drawText("Paid", {
      x: margin + firstColWidth + 10,
      y: tableTopY - 15,
      size: 10,
      font: fontBold,
      color: rgb(0.2, 0.25, 0.33),
    });

    rows.forEach((row, index) => {
      const rowTop = tableTopY - headerHeight - index * rowHeight;
      const rowBottom = rowTop - rowHeight;

      if (index > 0) {
        page.drawLine({
          start: { x: margin, y: rowTop },
          end: { x: margin + tableWidth, y: rowTop },
          thickness: 1,
          color: rgb(0.93, 0.94, 0.96),
        });
      }

      page.drawText(row.name, {
        x: margin + 10,
        y: rowBottom + 6,
        size: 10,
        font: fontRegular,
        color: rgb(0.13, 0.16, 0.21),
      });

      if (row.paid) {
        const tickCenterX = margin + firstColWidth + secondColWidth / 2;
        const tickCenterY = rowBottom + rowHeight / 2;
        // Draw a vector tick so we do not depend on font glyph support.
        page.drawLine({
          start: { x: tickCenterX - 5, y: tickCenterY - 1 },
          end: { x: tickCenterX - 1, y: tickCenterY - 5 },
          thickness: 1.6,
          color: rgb(0.02, 0.47, 0.34),
        });
        page.drawLine({
          start: { x: tickCenterX - 1, y: tickCenterY - 5 },
          end: { x: tickCenterX + 6, y: tickCenterY + 3 },
          thickness: 1.6,
          color: rgb(0.02, 0.47, 0.34),
        });
      }
    });

    y = tableBottomY - 20;
  };

  const logoBadgeWidth = 122;
  const logoBadgeHeight = 30;
  const logoBadgeX = (page.getWidth() - logoBadgeWidth) / 2;
  const logoBadgeY = page.getHeight() - margin - logoBadgeHeight;

  page.drawRectangle({
    x: logoBadgeX,
    y: logoBadgeY,
    width: logoBadgeWidth,
    height: logoBadgeHeight,
    color: rgb(0.06, 0.09, 0.16),
  });

  try {
    const logoBytes = await getLogoBytes(logoSrc);
    const logoImage = await pdfDoc.embedPng(logoBytes);
    const logoScale = 0.09;
    const logoWidth = logoImage.width * logoScale;
    const logoHeight = logoImage.height * logoScale;

    page.drawImage(logoImage, {
      x: logoBadgeX + (logoBadgeWidth - logoWidth) / 2,
      y: logoBadgeY + (logoBadgeHeight - logoHeight) / 2,
      width: logoWidth,
      height: logoHeight,
    });
  } catch {}

  y = logoBadgeY - 50;

  drawLine(`${tripDescription} - Trip Summary`, {
    bold: true,
    size: 19,
  });
  y -= 4;

  drawLine(`Departure: ${departureLabel}`);
  drawLine(`Total Cost: ${totalCostLabel}`);
  drawLine(`Seat Count: ${seatCountLabel}`);
  drawLine(`Seat Price: ${seatPriceLabel}`);
  y -= 4;
  ensureSpace(78);
  page.drawRectangle({
    x: margin,
    y: y - 62,
    width: page.getWidth() - margin * 2,
    height: 62,
    color: rgb(0.97, 0.98, 0.99),
    borderColor: rgb(0.86, 0.89, 0.94),
    borderWidth: 1,
  });
  page.drawText("Trip Summary Totals", {
    x: margin + 12,
    y: y - 16,
    size: 10,
    font: fontBold,
    color: rgb(0.2, 0.25, 0.33),
  });
  page.drawText(`Seats Booked: ${seatsBookedLabel}`, {
    x: margin + 12,
    y: y - 32,
    size: 11,
    font: fontRegular,
    color: rgb(0.13, 0.16, 0.21),
  });
  page.drawText(`Total Received: ${totalReceivedLabel}`, {
    x: margin + 12,
    y: y - 46,
    size: 11,
    font: fontRegular,
    color: rgb(0.13, 0.16, 0.21),
  });
  page.drawText(`Amount Outstanding: ${outstandingLabel}`, {
    x: page.getWidth() / 2 + 12,
    y: y - 46,
    size: 11,
    font: fontRegular,
    color: rgb(0.13, 0.16, 0.21),
  });
  y -= 74;
  y -= 28;

  if (groups.length === 0) {
    drawLine("No travellers booked for this trip.");
  }

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    if (index > 0) {
      y -= 18;
    }

    ensureSpace(58);
    drawLine(
      `${normalizeTime(group.pickupTime)} - ${group.pickupDescription} (${group.passengers.length} passenger${group.passengers.length === 1 ? "" : "s"})`,
      {
        bold: true,
        size: 13,
      },
    );

    // Keep the heading visually attached to its own passenger table.
    y += 6;

    drawGroupTable(group);
  }

  const pages = pdfDoc.getPages();
  const totalPages = pages.length;
  pages.forEach((docPage, index) => {
    const footerY = 16;
    const footerLeft = `Page ${index + 1} of ${totalPages}`;
    const footerRight = generatedAtLabel;
    const footerSize = 9;
    const footerColor = rgb(0.39, 0.45, 0.54);

    docPage.drawText(footerLeft, {
      x: margin,
      y: footerY,
      size: footerSize,
      font: fontRegular,
      color: footerColor,
    });

    const rightWidth = fontRegular.widthOfTextAtSize(footerRight, footerSize);
    docPage.drawText(footerRight, {
      x: docPage.getWidth() - margin - rightWidth,
      y: footerY,
      size: footerSize,
      font: fontRegular,
      color: footerColor,
    });
  });

  const bytes = await pdfDoc.save();
  const safeBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const blob = new Blob([safeBytes as unknown as ArrayBuffer], {
    type: "application/pdf",
  });
  return URL.createObjectURL(blob);
}

export default function TripReportsScreen() {
  const { tripId, tripDescription } = useLocalSearchParams<{
    tripId: string;
    tripDescription: string;
  }>();

  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const normalizedTripId = String(tripId ?? "");
  const normalizedTripDescription = String(tripDescription ?? "Trip");

  const hasConfig = useMemo(() => hasSupabaseConfig && Boolean(supabase), []);

  const generateTripSummary = async () => {
    if (!normalizedTripId) {
      setErrorMessage("Trip is missing.");
      return;
    }

    if (!hasConfig || !supabase) {
      setErrorMessage("Supabase is not configured.");
      return;
    }

    setRunning(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const [tripResult, bookingResult, logoSrc] = await Promise.all([
        supabase
          .from("trips")
          .select(
            "description, departure_date, departure_time, total_cost, seat_count, seat_price",
          )
          .eq("trip_id", normalizedTripId)
          .maybeSingle(),
        supabase
          .from("vw_org_customer_bookings")
          .select(
            "customer_name, paid, boarded, pickup_description, pickup_time, trip_description, departure_date, departure_time, total_cost, seat_count, seat_price, trip_seat_price",
          )
          .eq("trip_id", normalizedTripId),
        getWhiteLogoSrc(),
      ]);

      if (tripResult.error) {
        throw new Error(tripResult.error.message);
      }

      if (bookingResult.error) {
        throw new Error(bookingResult.error.message);
      }

      const rows = (bookingResult.data ?? []) as ReportRow[];
      const tripInfo = (tripResult.data ?? null) as TripInfo | null;
      const fallbackFromRows = rows[0] ?? null;

      const reportTripDescription =
        tripInfo?.description ||
        fallbackFromRows?.trip_description ||
        normalizedTripDescription;
      const departureLabel = formatDeparture(
        tripInfo?.departure_date || fallbackFromRows?.departure_date || null,
        tripInfo?.departure_time || fallbackFromRows?.departure_time || null,
      );
      const totalCostLabel = formatCurrency(
        tripInfo?.total_cost ?? fallbackFromRows?.total_cost ?? null,
      );
      const seatCountLabel = String(
        tripInfo?.seat_count ?? fallbackFromRows?.seat_count ?? "-",
      );
      const seatsBooked = rows.length;
      const totalReceived = rows.reduce((sum, row) => {
        const isPaid = Boolean(row.paid);
        if (!isPaid) {
          return sum;
        }

        const receivedAmount =
          row.seat_price ?? row.trip_seat_price ?? tripInfo?.seat_price ?? 0;
        return sum + (Number.isFinite(receivedAmount) ? receivedAmount : 0);
      }, 0);
      const outstandingAmount =
        tripInfo?.total_cost !== null && tripInfo?.total_cost !== undefined
          ? Math.max(0, tripInfo.total_cost - totalReceived)
          : null;
      const seatPriceLabel = formatCurrency(
        tripInfo?.seat_price ?? fallbackFromRows?.trip_seat_price ?? null,
      );
      const totalReceivedLabel = formatCurrency(totalReceived);
      const outstandingLabel = formatCurrency(outstandingAmount);

      const groups = buildGroups(rows);
      const paidCount = rows.filter((row) => Boolean(row.paid)).length;
      const generatedAtLabel = new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date());

      const html = buildReportHtml({
        tripDescription: reportTripDescription,
        departureLabel,
        totalCostLabel,
        seatCountLabel,
        seatsBookedLabel: String(seatsBooked),
        seatPriceLabel,
        totalReceivedLabel,
        outstandingLabel,
        travellerCount: rows.length,
        paidCount,
        groups,
        logoSrc,
        generatedAtLabel,
      });

      const result = await Print.printToFileAsync({
        html,
      });

      await Linking.openURL(result.uri);
      setMessage("PDF preview opened.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to generate trip summary report.",
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Reports</Text>
          </View>
          <Text style={styles.title}>Trip summary</Text>
          <Text style={styles.subtitle}>{normalizedTripDescription}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.card,
            pressed && !running && styles.cardPressed,
            running && styles.cardDisabled,
          ]}
          onPress={generateTripSummary}
          disabled={running}
        >
          <View style={styles.cardIconWrap}>
            <Text style={styles.cardIcon}>📄</Text>
          </View>
          <Text style={styles.cardTitle}>Generate report</Text>
          <Text style={styles.cardDescription}>
            Export a polished passenger summary for this trip.
          </Text>

          {running ? <ActivityIndicator color="#2563eb" size="small" /> : null}

          {message ? <Text style={styles.successText}>{message}</Text> : null}
          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}
        </Pressable>

        <Pressable
          style={styles.backIconButton}
          onPress={() =>
            router.push({
              pathname: "/trip-actions",
              params: {
                tripId: normalizedTripId,
                tripDescription: normalizedTripDescription,
              },
            })
          }
        >
          <Text style={styles.backIconText}>←</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#07111f",
  },
  container: {
    flex: 1,
    padding: 24,
  },
  heroCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#dbeafe",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  heroBadgeText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 2,
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    shadowColor: "#0f172a",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardDisabled: {
    opacity: 0.7,
  },
  cardIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  cardIcon: {
    fontSize: 28,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },
  successText: {
    marginTop: 12,
    color: "#047857",
    fontWeight: "600",
    fontSize: 13,
  },
  errorText: {
    marginTop: 12,
    color: "#b91c1c",
    fontWeight: "600",
    fontSize: 13,
  },
  backIconButton: {
    alignSelf: "center",
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    marginTop: 18,
    shadowColor: "#2563eb",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  backIconText: {
    color: "#fff",
    fontSize: 24,
    lineHeight: 24,
    fontWeight: "700",
  },
});
