"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"

interface ThesisDisplayProps {
  thesis: string
  sessionId: string
}

export function ThesisDisplay({ thesis, sessionId }: ThesisDisplayProps) {
  const [status, setStatus] = useState<"review" | "accepted" | "denied" | "regenerating">("review")
  const [feedback, setFeedback] = useState("")
  const [currentThesis, setCurrentThesis] = useState(thesis)
  const [loading, setLoading] = useState(false)

  let parsedThesis: any = {}
  try {
    parsedThesis = JSON.parse(currentThesis)
  } catch (e) {
    console.error("Failed to parse thesis:", e)
  }

  const thesisData = parsedThesis.thesis || parsedThesis

  const handleAccept = async () => {
    setStatus("accepted")
  }

  const handleDeny = () => {
    setStatus("denied")
  }

  const handleRegenerate = async () => {
    if (!feedback.trim()) return
    
    setLoading(true)
    setStatus("regenerating")
    
    try {
      // Call API to regenerate thesis with feedback
      const response = await fetch(`/api/clarify/regenerate-thesis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          feedback: feedback.trim()
        })
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentThesis(data.thesis || JSON.stringify(data.filters))
        setFeedback("")
        setStatus("review")
      } else {
        console.error("Failed to regenerate thesis")
      }
    } catch (error) {
      console.error("Error regenerating thesis:", error)
    } finally {
      setLoading(false)
    }
  }

  if (status === "accepted") {
    return (
      <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-800">
        <CardContent className="p-6 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-emerald-800 dark:text-emerald-200 mb-2">
            Thank you! Your criteria has been accepted.
          </h3>
          <p className="text-emerald-700 dark:text-emerald-300">
            We will find all the drug assets that meet this criteria in the next <strong>14-18 hours</strong> and send them to you via email.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (status === "denied") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-600" />
            Please provide feedback on the criteria
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="feedback">What changes would you like to make?</Label>
            <Textarea
              id="feedback"
              placeholder="Please describe what changes you'd like to see in the criteria..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="mt-1 min-h-[100px]"
            />
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleRegenerate} 
              disabled={!feedback.trim() || loading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Regenerating...
                </>
              ) : (
                "Regenerate Criteria"
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setStatus("review")}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (status === "regenerating") {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Loader2 className="w-8 h-8 text-emerald-600 mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-semibold mb-2">Regenerating criteria...</h3>
          <p className="text-muted-foreground">
            Applying your feedback to create updated criteria.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Research Criteria</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Executive Summary */}
        {thesisData.executive_summary && (
          <div className="bg-emerald-50 dark:bg-emerald-950 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <h3 className="font-bold text-emerald-800 dark:text-emerald-200 mb-2">Executive Summary</h3>
            <p className="text-emerald-700 dark:text-emerald-300 leading-relaxed font-medium">{thesisData.executive_summary}</p>
          </div>
        )}

        {/* Key Assumptions */}
        {thesisData.key_assumptions && Array.isArray(thesisData.key_assumptions) && (
          <div>
            <h3 className="font-semibold text-foreground mb-3">Key Assumptions</h3>
            <ul className="space-y-3">
              {thesisData.key_assumptions.map((assumption: string, index: number) => (
                <li key={index} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  <span className="w-2 h-2 bg-emerald-600 rounded-full mt-1.5 flex-shrink-0" />
                  <span className="text-foreground leading-relaxed">{assumption}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Refined Scope */}
        {thesisData.refined_scope && (
          <div>
            <h3 className="font-semibold text-foreground mb-3">Refined Scope</h3>
            <p className="text-foreground leading-relaxed bg-muted p-4 rounded-lg">{thesisData.refined_scope}</p>
          </div>
        )}

        {/* Search Parameters */}
        {thesisData.search_parameters && (
          <div>
            <h3 className="font-semibold text-foreground mb-3">Search Parameters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {thesisData.search_parameters.primary_targets && (
                <div className="p-3 bg-muted rounded-lg">
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Primary Targets</h4>
                  <div className="flex flex-wrap gap-1">
                    {thesisData.search_parameters.primary_targets.map((target: string, i: number) => (
                      <span key={i} className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded">{target}</span>
                    ))}
                  </div>
                </div>
              )}
              {thesisData.search_parameters.indication_focus && (
                <div className="p-3 bg-muted rounded-lg">
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Indications</h4>
                  <div className="flex flex-wrap gap-1">
                    {thesisData.search_parameters.indication_focus.map((indication: string, i: number) => (
                      <span key={i} className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-xs rounded">{indication}</span>
                    ))}
                  </div>
                </div>
              )}
              {thesisData.search_parameters.development_stages && (
                <div className="p-3 bg-muted rounded-lg">
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Development Stages</h4>
                  <div className="flex flex-wrap gap-1">
                    {thesisData.search_parameters.development_stages.map((stage: string, i: number) => (
                      <span key={i} className="px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 text-xs rounded">{stage}</span>
                    ))}
                  </div>
                </div>
              )}
              {thesisData.search_parameters.modality_filters && (
                <div className="p-3 bg-muted rounded-lg">
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Modalities</h4>
                  <div className="flex flex-wrap gap-1">
                    {thesisData.search_parameters.modality_filters.map((modality: string, i: number) => (
                      <span key={i} className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs rounded">{modality}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Strategic Rationale */}
        {thesisData.strategic_rationale && (
          <div>
            <h3 className="font-semibold text-foreground mb-3">Strategic Rationale</h3>
            <p className="text-foreground leading-relaxed bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">{thesisData.strategic_rationale}</p>
          </div>
        )}

        {/* Market Intelligence */}
        {thesisData.market_intelligence && (
          <div>
            <h3 className="font-semibold text-foreground mb-3">Market Intelligence</h3>
            <p className="text-foreground leading-relaxed bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">{thesisData.market_intelligence}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button 
            onClick={handleAccept}
            className="bg-emerald-600 hover:bg-emerald-700 flex-1"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Accept Criteria
          </Button>
          <Button 
            variant="outline" 
            onClick={handleDeny}
            className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950 flex-1"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Request Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
