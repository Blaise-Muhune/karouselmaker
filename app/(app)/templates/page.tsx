import { getUser } from "@/lib/server/auth/getUser";
import { listTemplatesForUser } from "@/lib/server/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LockIcon } from "lucide-react";

export default async function TemplatesPage() {
  const { user } = await getUser();
  const templates = await listTemplatesForUser(user.id, { includeSystem: true });

  const systemTemplates = templates.filter((t) => t.user_id == null);
  const userTemplates = templates.filter((t) => t.user_id === user.id);

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold">Templates</h1>
        <p className="text-muted-foreground text-sm">
          Locked layouts for carousel slides. System templates are read-only; user templates can be edited later.
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">System templates</CardTitle>
            <CardDescription>
              Pre-defined layouts (hook, point, context, cta, generic). Used when no template is chosen per slide.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {systemTemplates.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No system templates. Run the seed migration to add them.
              </p>
            ) : (
              <ul className="space-y-2">
                {systemTemplates.map((t) => (
                  <li
                    key={t.id}
                    className="border-border flex items-center gap-3 rounded-lg border p-3"
                  >
                    <LockIcon className="text-muted-foreground size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{t.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {t.category} · {t.aspect_ratio}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your templates</CardTitle>
            <CardDescription>
              Custom templates (editable in a future update).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {userTemplates.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No custom templates yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {userTemplates.map((t) => (
                  <li
                    key={t.id}
                    className="border-border flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{t.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {t.category} · {t.aspect_ratio}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
