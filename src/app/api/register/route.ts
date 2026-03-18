import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBillingPlanByCheckoutKey } from "@/lib/billingPlans";
import {
  createOrganizationCheckoutSession,
  isStripeConfigured,
} from "@/lib/stripeBilling";
import { getDb, getMongoClient, isDbConfigured } from "@/lib/mongodb";
import {
  OnboardingConflictError,
  OnboardingValidationError,
  runSelfServiceOnboarding,
} from "@/lib/selfServiceOnboarding";
import { mapMongoDuplicateKeyToOnboardingConflict } from "@/lib/onboardingConflicts";

export async function POST(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "Base de datos no configurada." },
      { status: 503 },
    );
  }

  try {
    const body = await req.json();
    const session = await getServerSession(authOptions);

    if (session?.user?.id) {
      console.warn(
        "[POST /api/register] authenticated user hit registration endpoint",
        {
          userId: session.user.id,
          email: session.user.email,
        },
      );
      return NextResponse.json(
        {
          error:
            "Los usuarios autenticados deben crear organizaciones desde el endpoint dedicado.",
          errorCode: "use_organization_creation_endpoint",
        },
        { status: 400 },
      );
    }

    const selectedPlan = getBillingPlanByCheckoutKey(body.planKey);

    if (!selectedPlan || !selectedPlan.active || !selectedPlan.stripePriceId) {
      return NextResponse.json(
        {
          error: "El plan seleccionado no esta configurado para este entorno.",
          errorCode: "validation_error",
        },
        { status: 400 },
      );
    }

    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: "Stripe no esta configurado.", errorCode: "validation_error" },
        { status: 503 },
      );
    }

    const client = await getMongoClient();
    const db = await getDb();

    const onboarding = await runSelfServiceOnboarding(client, db, {
      fullName: body.adminName ?? body.fullName ?? session?.user?.name ?? "",
      email: body.adminEmail ?? body.email ?? session?.user?.email ?? "",
      password: body.password ?? "",
      organizationName: body.orgName ?? body.organizationName ?? "",
      plan: selectedPlan.productKey,
      billingInterval: selectedPlan.interval,
      requiresCheckout: true,
      authenticatedUserId: session?.user?.id ?? null,
      strictOrganizationConflicts: true,
    });

    try {
      const checkout = await createOrganizationCheckoutSession({
        organizationId: onboarding.organizationId,
        userId: onboarding.userId,
        userEmail: String(
          body.adminEmail ?? body.email ?? session?.user?.email ?? "",
        )
          .trim()
          .toLowerCase(),
        userName: body.adminName ?? body.fullName ?? session?.user?.name ?? "",
        planKey: selectedPlan.productKey,
        interval: selectedPlan.interval,
      });

      return NextResponse.json({
        success: true,
        ...onboarding,
        checkoutUrl: checkout.url,
        createdUser: !session?.user?.id,
        requiresLogin: !session?.user?.id,
      });
    } catch (checkoutError) {
      console.error(
        "[POST /api/register] checkout bootstrap failed",
        checkoutError,
      );
      return NextResponse.json({
        success: true,
        ...onboarding,
        checkoutUrl: null,
        createdUser: !session?.user?.id,
        requiresLogin: !session?.user?.id,
        warning:
          "La organizacion fue creada, pero no se pudo abrir Stripe Checkout. Inicia sesion y reintenta el checkout desde billing.",
      });
    }
  } catch (error: any) {
    if (error instanceof OnboardingValidationError) {
      return NextResponse.json(
        { error: error.message, errorCode: "validation_error" },
        { status: 400 },
      );
    }

    if (error instanceof OnboardingConflictError) {
      console.warn("[POST /api/register] onboarding conflict", {
        errorCode: error.code,
        message: error.message,
      });
      return NextResponse.json(
        { error: error.message, errorCode: error.code },
        { status: 409 },
      );
    }

    const duplicateConflict = mapMongoDuplicateKeyToOnboardingConflict(error);
    if (duplicateConflict) {
      console.warn("[POST /api/register] duplicate key conflict", {
        errorCode: duplicateConflict.code,
        message: duplicateConflict.message,
        keyPattern: error?.keyPattern,
        keyValue: error?.keyValue,
      });
      return NextResponse.json(
        { error: duplicateConflict.message, errorCode: duplicateConflict.code },
        { status: 409 },
      );
    }

    console.error("[POST /api/register]", error);
    return NextResponse.json(
      { error: "No se pudo completar el onboarding." },
      { status: 500 },
    );
  }
}
