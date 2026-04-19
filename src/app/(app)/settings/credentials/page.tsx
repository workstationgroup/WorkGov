import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CredentialsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">e-GP Credentials</CardTitle>
        <CardDescription>
          Login credentials for the e-GP system (process5.gprocurement.go.th).
          These are stored securely as environment variables.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="egp-username">Username</Label>
          <Input id="egp-username" placeholder="Set via EGP_USERNAME env variable" disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="egp-password">Password</Label>
          <Input id="egp-password" type="password" placeholder="Set via EGP_PASSWORD env variable" disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="data-api-key">data.go.th API Key</Label>
          <Input id="data-api-key" placeholder="Set via DATA_GO_TH_API_KEY env variable" disabled />
        </div>
        <p className="text-xs text-muted-foreground">
          Credentials are managed through Vercel environment variables for security.
          Set them in your Vercel project settings or via the CLI.
        </p>
      </CardContent>
    </Card>
  );
}
